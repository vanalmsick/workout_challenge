from django.conf import settings
from django.db.models import Q
from django.core.exceptions import PermissionDenied
from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from rest_framework.permissions import BasePermission

from django.db.models import Sum

from custom_user.views import IsOwnerOrReadOnly
from custom_user.models import CustomUser
from custom_user.strava import sync_strava
from custom_user.point_recalc import recalc_points
from .models import Competition, Team, ActivityGoal, Points
from .serializers import CompetitionSerializer, TeamSerializer, ActivityGoalSerializer, PointsSerializer
from .stats import get_competition_stats

from celery import current_app
import json
import logging

logger = logging.getLogger(__name__)

class CompetitionViewSet(viewsets.ModelViewSet):
    #queryset = Competition.objects.all()
    serializer_class = CompetitionSerializer

    permission_classes = [IsOwnerOrReadOnly]

    def get_queryset(self):
        # return all competitions the user is owner of or a participant of
        #time.sleep(3)  # throttle for testing
        return Competition.objects.filter(Q(owner=self.request.user) | Q(user=self.request.user)).distinct().order_by('-end_date', '-start_date', '-id')

    def perform_create(self, serializer):
        # when creating a new competition, set the owner to the request user
        serializer.save(owner=self.request.user)


class TeamViewSet(viewsets.ModelViewSet):
    #queryset = Team.objects.all()
    serializer_class = TeamSerializer

    permission_classes = [IsOwnerOrReadOnly]

    def get_queryset(self):
        # return all teams the user is a member of and all teams of competitions the user participates in
        #time.sleep(3)  # throttle for testing
        return Team.objects.filter(Q(user=self.request.user) | Q(competition__user=self.request.user)).distinct().order_by('name')

    def perform_create(self, serializer):

        competition_obj = serializer.validated_data.get('competition')

        # if has_teams is disabled, don't allow creation of teams
        if competition_obj.has_teams is False:
            raise PermissionDenied("Teams are disabled for this competition.")

        # only allow user to create a team if they are a member or owner of the competition
        if not (competition_obj.owner == self.request.user) and not (competition_obj in self.request.user.my_competitions.all()):
            raise PermissionDenied("You are not a participant of the competition you want to create a team for.")

        serializer.save()


class ActivityGoalViewSet(viewsets.ModelViewSet):
    #queryset = ActivityGoal.objects.all()
    serializer_class = ActivityGoalSerializer

    permission_classes = [IsOwnerOrReadOnly]

    def get_queryset(self):
        # return all competition categories the user is owner of or a participant of
        #time.sleep(3)  # throttle for testing
        return ActivityGoal.objects.filter(Q(competition__owner=self.request.user) | Q(competition__user=self.request.user)).distinct().order_by('name')

    def perform_create(self, serializer):
        competition_obj = serializer.validated_data.get('competition')

        # only allow user to create a team if they are a member or owner of the competition
        if competition_obj.owner != self.request.user:
            raise PermissionDenied("You can only create and edit competition goals if you are the owner.")

        serializer.save()


class PointsViewSet(viewsets.ModelViewSet):
    #queryset = Points.objects.all()
    serializer_class = PointsSerializer

    permission_classes = [IsOwnerOrReadOnly]

    def get_queryset(self):
        # return all points the user is owner of, a participant of, or of his/her own workouts
        #time.sleep(3)  # throttle for testing
        return Points.objects.filter(Q(goal__competition__owner=self.request.user) | Q(goal__competition__user=self.request.user) | Q(workout__user=self.request.user)).distinct().order_by('-workout__start_datetime', '-workout__duration', '-workout', '-workout__user')


class StatsPermissions(BasePermission):
    def has_permission(self, request, view):
        # Only authenticated users
        if request.user.is_authenticated:
            return True
        return False

    def has_object_permission(self, request, view, obj):
        competition_lst = Competition.objects.filter(
            Q(pk=view.kwargs.get('competition', 0)) & (Q(owner=request.user) | Q(user=request.user))
        )
        return len(competition_lst) > 0


class IsAdmin(BasePermission):
    """
    Custom permission class to allow access only to admin users.
    """
    def has_permission(self, request, view):
        # Check if user is authenticated and is an admin
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)


class CeleryQueryView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, task_id=None):
        if task_id:
            # Get status of specific task
            try:
                task = current_app.AsyncResult(task_id)
                return Response({
                    'task_id': task.id,
                    'status': task.status,
                    'result': task.result if task.successful() else None,
                    'error': str(task.result) if task.failed() else None
                })
            except Exception:
                logger.exception("Error retrieving status of task %s", task_id)
                return Response(
                    {"error": "Error retrieving task status"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            # List all registered tasks
            try:
                registered_tasks = [
                    name
                    for name, task in sorted(current_app.tasks.items())
                    if not name.startswith('celery.')
                ]
                return Response(registered_tasks)
            except Exception:
                logger.exception("Error retrieving registered tasks")
                return Response(
                    {"error": "Error retrieving tasks"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

    def post(self, request):
        task = request.query_params.get('task')
        args = request.query_params.get('args', '[]')
        kwargs = request.query_params.get('kwargs', '{}')
        
        if not task:
            return Response(
                {"error": "Task name is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            # Convert string args and kwargs to Python objects
            args_list = json.loads(args)
            kwargs_dict = json.loads(kwargs)
            
            # Get the task by name and apply it with args and kwargs
            celery_task = current_app.tasks[task]
            result = celery_task.delay(*args_list, **kwargs_dict)
            
            return Response({
                "task_id": result.task_id,
                "status": "Task sent successfully"
            })
            
        except json.JSONDecodeError:
            return Response(
                {"error": "Invalid JSON format in args or kwargs"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except KeyError:
            return Response(
                {"error": f"Task '{task}' not found"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception:
            logger.exception("Error dispatching task %s", task)
            return Response(
                {"error": "Error dispatching task"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CompetitionStatsQueryView(APIView):
    permission_classes = [StatsPermissions]

    @method_decorator(cache_page(30))  # cache for 30 seconds
    def get(self, request, competition):
        response_obj = get_competition_stats(competition)
        self.check_object_permissions(request, response_obj)
        return Response(response_obj)


class FeedPermissions(BasePermission):
    def has_permission(self, request, view):
        # Only authenticated users
        if request.user.is_authenticated:
            return True
        return False

    def has_object_permission(self, request, view, obj):
        if len(obj) == 0:
            return False
        obj = obj[0]
        return request.user.id in [obj.owner.pk] + list(obj.user.all().values_list('pk', flat=True))


class FeedQueryView(APIView):
    """ API view to get the activity/point feed for a competition. """
    permission_classes = [FeedPermissions]

    def get(self, request, competition):
        # Custom query logic
        #time.sleep(3)  # throttle for testing

        competition_obj = Competition.objects.filter(id=competition)
        self.check_object_permissions(request, competition_obj)

        all_points = Points.objects.filter(Q(award__competition__id=competition) | Q(goal__competition_id=competition)).order_by('-workout__start_datetime', '-workout__steps', '-workout__duration', '-workout', '-workout__user')

        grouped_points = {i['workout']: i for i in all_points.values('workout__user', 'workout__user__username', 'workout__user__strava_allow_follow', 'workout', 'workout__sport_type', 'workout__start_datetime', 'workout__duration', 'workout__steps', 'workout__strava_id', 'award').annotate(points_capped=Sum('points_capped'), points_raw=Sum('points_raw')).order_by('-workout__start_datetime', '-workout__duration', '-workout', '-workout__user')}

        for i in all_points.values('workout', 'id', 'goal', 'goal__name', 'award', 'award__name', 'points_capped', 'points_raw'):
            if 'details' not in grouped_points[i['workout']]:
                grouped_points[i['workout']]['details'] = []
            grouped_points[i['workout']]['details'].append(i)

        return Response(list(grouped_points.values()))



class JoinCompetitionView(APIView):
    """ API post view for users to join a competition. """
    permission_classes = [IsAuthenticated]

    def post(self, request, join_code):
        competition = Competition.objects.filter(join_code=join_code.upper())
        if len(competition) == 0:
            return Response({"message": "Invalid join code."}, status=status.HTTP_400_BAD_REQUEST)
        competition = competition[0]
        competition.user.add(request.user)
        competition.save()
        return Response({"message": "Successfully joined competition.", "competition": competition.id}, status=status.HTTP_200_OK)

    def delete(self, request, join_code):
        id = int(join_code)

        request.user.my_competitions.remove(id)
        teams = request.user.my_teams.filter(competition=id)
        for team in teams:
            team.user.remove(request.user)
            team.save()
        request.user.save()

        points = Points.objects.filter((Q(award__competition__id=id) | Q(goal__competition_id=id)) & Q(workout__user=request.user))
        points.delete()

        return Response({"message": "Successfully left competition.", "competition": id}, status=status.HTTP_200_OK)


class JoinTeamView(APIView):
    """ API post view for users to join a team and make sure they are only a member of one team per competition. """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        team_id = request.query_params.get('team')
        team = Team.objects.filter(id=team_id)
        if len(team) == 0:
            return Response({"message": "Invalid team id."}, status=status.HTTP_400_BAD_REQUEST)
        team = team[0]

        user_id = request.query_params.get('user', request.user.id)
        user = CustomUser.objects.filter(id=user_id)
        if len(user) == 0:
            return Response({"message": "Invalid user id."}, status=status.HTTP_400_BAD_REQUEST)
        user = user[0]

        competition = team.competition
        competition_teams = competition.team_set.all()

        if user != request.user and request.user != competition.owner and len(competition_teams.filter(user=user)) > 0:
            return Response({"message": "Unauthorized. You can only change your own team or add people to your team if they are currently in no team."}, status=status.HTTP_403_FORBIDDEN)

        for competition_team in competition_teams:
            competition_team.user.remove(user.id)
            competition_team.save()
        user.my_teams.add(team.id)
        user.save()

        return Response({"message": "Successfully joined team.", "team": team.id, "user": user.id}, status=status.HTTP_200_OK)