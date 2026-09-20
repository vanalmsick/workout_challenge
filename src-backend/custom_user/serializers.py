from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from django.conf import settings
from django.contrib.auth import password_validation
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes
from django.template.loader import render_to_string

from .models import CustomUser
from .fields import LowercaseEmailField
from .emails.multipurpose import send_email


def _validate_password(password, user, field='password'):
    """ Run AUTH_PASSWORD_VALIDATORS, reported as a DRF field error. """
    try:
        password_validation.validate_password(password, user)
    except DjangoValidationError as e:
        raise serializers.ValidationError({field: list(e.messages)})


def revoke_refresh_tokens(user):
    """ Blacklist every refresh token issued to the user, i.e. log them out everywhere.
    Access tokens stay valid until they expire (ACCESS_TOKEN_LIFETIME, 5 min). """
    from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)


class CustomUserSerializer(serializers.ModelSerializer):
    my = serializers.SerializerMethodField()
    # Declared explicitly so the address is lower-cased before the uniqueness
    # check runs - otherwise 'A@b.com' would slip past an existing 'a@b.com'.
    email = LowercaseEmailField(
        max_length=254,
        validators=[UniqueValidator(queryset=CustomUser.objects.all(), lookup='iexact')],
    )
    # Only needed to change the e-mail address - see validate()
    current_password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = CustomUser
        fields = ['id', 'my', 'email', 'first_name', 'last_name', 'gender', 'username', 'password', 'current_password', 'is_verified', 'email_mid_week', 'strava_athlete_id', 'strava_allow_follow', 'strava_last_synced_at', 'my_competitions', 'my_teams', 'goal_active_days', 'goal_workout_minutes', 'goal_distance', 'scaling_kcal', 'scaling_distance']
        # my_competitions / my_teams are changed only via the join endpoints, which check the join code and team rules
        read_only_fields = ['is_verified', 'strava_athlete_id', 'strava_last_synced_at', 'my_competitions', 'my_teams']
        extra_kwargs = {
            'password': {'write_only': True},
        }

    def get_my(self, obj):
        user = self.context['request'].user
        return obj.pk == user.pk

    def validate(self, attrs):
        current_password = attrs.pop('current_password', '')
        if self.instance is None:
            # registration - UserAttributeSimilarityValidator needs the would-be user
            _validate_password(attrs.get('password'), CustomUser(email=attrs.get('email'), first_name=attrs.get('first_name'), last_name=attrs.get('last_name')))
        elif 'email' in attrs and attrs['email'] != self.instance.email and not self.instance.check_password(current_password):
            # the e-mail is the login and where password resets go, so a stolen access token must not be enough to change it
            raise serializers.ValidationError({'current_password': 'Enter your current password to change your email address.'})
        return attrs

    def create(self, validated_data):
        user = CustomUser.objects.create_user(
            email=validated_data.get('email'),
            first_name=validated_data.get('first_name'),
            last_name=validated_data.get('last_name', None),
            password=validated_data.get('password'),
            gender=validated_data.get('gender', None),
        )
        return user

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        user = self.context['request'].user

        # Omit 'secret' fields of other users that this user is not allowed to see
        if instance.pk != user.pk:
            rep.pop('email', None)
            rep.pop('first_name', None)
            rep.pop('last_name', None)
            rep.pop('gender', None)
            rep.pop('password', None)
            rep.pop('strava_last_synced_at', None)

            if not rep['strava_allow_follow']:
                rep.pop('strava_athlete_id', None)

        return rep


    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # If instance exists, it's an update (PUT/PATCH), make fields optional
        if self.instance:
            # Password is set on registration and changed via the password reset flow only. A writable field here
            # would be saved un-hashed by ModelSerializer.update() and skip the password validators.
            self.fields.pop('password')
            self.fields['email'].required = False
            self.fields['first_name'].required = False
            self.fields['last_name'].required = False


class PasswordResetSerializer(serializers.Serializer):
    email = LowercaseEmailField()

    def save(self, request):
        email = self.validated_data['email']
        users = CustomUser.objects.filter(email__iexact=email)
        for user in users:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_url = f"{settings.MAIN_HOST}/password/reset/{uid}/{token}/"

            email_subject = "Workout Challenge - Reset Your Password"
            email_body = render_to_string(
                "email_password_reset.html",
                {
                    'first_name': user.first_name,
                    'MAIN_HOST': settings.MAIN_HOST,
                    'RESET_URL': reset_url,
                    'EMAIL_REPLY_TO': settings.EMAIL_REPLY_TO[0] if settings.EMAIL_REPLY_TO is not None else settings.EMAIL_FROM,
                }
            )

            send_email(subject=email_subject, body=email_body, to_email=user.email)



class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        try:
            uid = urlsafe_base64_decode(attrs['uid']).decode()
            self.user = CustomUser.objects.get(pk=uid)
        except (CustomUser.DoesNotExist, ValueError):
            raise serializers.ValidationError("Invalid user.")

        if not default_token_generator.check_token(self.user, attrs['token']):
            raise serializers.ValidationError("Invalid or expired token.")

        _validate_password(attrs['new_password'], self.user, field='new_password')
        return attrs

    def save(self):
        self.user.set_password(self.validated_data['new_password'])
        self.user.save()
        revoke_refresh_tokens(self.user)