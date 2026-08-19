import time, datetime
import requests
from rest_framework import viewsets
from rest_framework.permissions import BasePermission, IsAdminUser, SAFE_METHODS, AllowAny
from rest_framework.permissions import IsAuthenticated
from django.db import IntegrityError, transaction
from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from celery.exceptions import TimeoutError
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from django.shortcuts import get_object_or_404
from django.conf import settings
from django.core.cache import cache

from .serializers import PasswordResetSerializer, PasswordResetConfirmSerializer
from .models import CustomUser
from .serializers import CustomUserSerializer
from .filters import CustomUserFilter
from .strava import sync_strava

class IsOwnerOrReadOnly(BasePermission):
    """ Permission class to only allow admins and owner to edit or delete entry """
    def has_permission(self, request, view):
        # Only authenticated users
        if request.user.is_authenticated:
            return True
        return False

    def has_object_permission(self, request, view, obj):
        # Read requests always allowed
        if request.method in SAFE_METHODS:
            return True  # allow GET, HEAD, OPTIONS (GET is filtered at viweset level to only show allowed entries)
        # Only workout user can edit workout
        if hasattr(obj, 'user') and obj.user == request.user:
            return True
        # Only owner of competition can modify
        elif hasattr(obj, 'owner') and obj.owner == request.user:
            return True
        # Only owner can modify goals and awards
        elif hasattr(obj, 'competition') and hasattr(obj.competition, 'owner') and obj.competition.owner == request.user:
            return True
        # If admin allow all requests
        if bool(request.user and request.user.is_staff):
            return True
        return False


class UserPermissionClass(BasePermission):
    """ Allow unauthenticated users to POST data - i.e. for registration """
    def has_permission(self, request, view):
        # Only create new requsts - i.e. POST
        if request.method in ('POST', 'OPTIONS'):
            return True
        return request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        return obj.pk == request.user.pk


class CustomUserViewSet(viewsets.ModelViewSet):
    #queryset = Competition.objects.all()
    serializer_class = CustomUserSerializer

    filter_backends = [DjangoFilterBackend]
    filterset_class = CustomUserFilter

    permission_classes = [UserPermissionClass]

    def get_queryset(self):
        # return all competitions the user is owner of or a participant of
        #time.sleep(3)  # throttle for testing
        return CustomUser.objects.filter(Q(pk=self.request.user.pk) | Q(my_competitions__in=self.request.user.my_competitions.all())).distinct().order_by('username', 'id')

    def get_object(self):
        lookup_value = self.kwargs.get(self.lookup_field)

        # Modify filter if I ask for myself instead of the id number
        if str(lookup_value).lower() in ['me', 'my', 'myself', 'i']:
            lookup_value = self.request.user.id

        return get_object_or_404(self.get_queryset(), pk=lookup_value)


class PasswordResetView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(request=request)
            return Response({"detail": "Password reset e-mail sent."})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({"detail": "Password has been reset."})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LinkStravaView(APIView):
    """ API post view for users to link with Strava. """
    permission_classes = [IsAuthenticated]

    @staticmethod
    def _already_linked_response(athlete_id, user):
        """ Return a 409 response if this Strava athlete is already linked to another account, else None. """
        if athlete_id is None:
            return None

        other_user = CustomUser.objects.filter(strava_athlete_id=athlete_id).exclude(pk=user.pk).first()
        if other_user is None:
            return None

        return Response(
            {
                "message": f"This Strava account is already linked to the account with the email address {other_user.email}. "
                           f"Please log in with that account and unlink Strava there first, or link a different Strava account.",
                "code": "strava_already_linked",
                "linked_email": other_user.email,
            },
            status=status.HTTP_409_CONFLICT,
        )

    def post(self, request, code):
        user = request.user
        client_id = settings.STRAVA_CLIENT_ID
        client_secret = settings.STRAVA_CLIENT_SECRET

        if client_id == 1234321 or client_secret == "ReplaceWithClientSecret":
            return Response({"message": "Sever configuration error - STRAVA_CLIENT_ID and/or STRAVA_CLIENT_SECRET are not set."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        response = requests.post(
            url='https://www.strava.com/oauth/token',
            data={
                'client_id': client_id,
                'client_secret': client_secret,
                'code': code,
                'grant_type': 'authorization_code'
            }
        )

        if response.ok is False:
            return Response({"message": "Invalid Strava linkage code"}, status=status.HTTP_400_BAD_REQUEST)

        strava_tokens = response.json()
        athlete_id = strava_tokens.get('athlete', {}).get('id', None)

        # This Strava account may already belong to a different user of this app
        already_linked = self._already_linked_response(athlete_id, user)
        if already_linked is not None:
            return already_linked

        setattr(user, 'strava_refresh_token', strava_tokens.get('refresh_token', None))
        setattr(user, 'strava_athlete_id', athlete_id)
        try:
            with transaction.atomic():
                user.save()
        except IntegrityError:
            # Race condition - another user linked the same Strava account in the meantime
            already_linked = self._already_linked_response(athlete_id, user)
            if already_linked is not None:
                return already_linked
            return Response(
                {"message": "This Strava account is already linked to another account.",
                 "code": "strava_already_linked"},
                status=status.HTTP_409_CONFLICT,
            )

        cache.set(f"strava_access_token_{user.id}", strava_tokens.get('access_token', None), int(strava_tokens.get('expires_in', 21600)) - 60)
        try:
            running_task = sync_strava.delay(user__id=user.id, start_datetime=datetime.datetime.now() - datetime.timedelta(days=43))
            try:
                running_task.get(timeout=100)
            except TimeoutError:
                print(f"Strava sync task is still running ({running_task.id}). Don't let the user wait so long.")
        except requests.exceptions.HTTPError as err:
            if '401 Client Error: Unauthorized' in str(err):
                return Response({'message': 'Access to activities denied by Strava. Not sufficient permissions to download activities.'}, status=status.HTTP_403_FORBIDDEN)
            else:
                err_response = getattr(err, 'response', None)
                if err_response is None:
                    return Response({'message': f'Strava request failed: {err}'}, status=status.HTTP_502_BAD_GATEWAY)
                try:
                    err_body = err_response.json()
                except ValueError:  # Strava did not answer with JSON
                    err_body = None
                if not isinstance(err_body, dict):
                    err_body = {}
                err_body.setdefault('message', f'Strava request failed: {err}')
                return Response(err_body, status=err_response.status_code)

        return Response({"message": "Successfully linked Strava."}, status=status.HTTP_200_OK)


class UnlinkStravaView(APIView):
    """ API post view for users to unlink Strava. """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        setattr(user, 'strava_refresh_token', None)
        setattr(user, 'strava_athlete_id', None)
        user.save()

        return Response({"message": "Successfully unlinked Strava."}, status=status.HTTP_200_OK)


class SyncStravaView(APIView):
    """ API get view for users to sync Strava. """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.strava_refresh_token is None or user.strava_refresh_token == '':
            return Response({"message": "Strava is not linked."}, status=status.HTTP_400_BAD_REQUEST)

        if user.strava_last_synced_at is None or user.strava_last_synced_at == '' or user.strava_last_synced_at < (timezone.now() - datetime.timedelta(minutes=59)):
            sync_strava(user__id=user.id)
            return Response({"message": f"Successfully synced Strava."}, status=status.HTTP_200_OK)

        return Response({"message": "Too many requests! You can only request a Strava sync every 60 minutes."}, status=status.HTTP_429_TOO_MANY_REQUESTS)