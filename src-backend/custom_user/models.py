import requests
import qrcode, datetime
from decimal import Decimal

from django.db import models
from django.utils.translation import gettext_lazy as _

from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from django.conf import settings
from django.db.models.signals import m2m_changed
from django.dispatch import receiver

from competition.scorer import trigger_user_change
from custom_user.emails.celery_emails import welcome_email

# Create your models here.
GENDER_CHOICES = [
    ('M', 'Male'),
    ('F', 'Female'),
    ('O', 'Other'),
]

class CustomUserManager(BaseUserManager):
    """
    Custom user model manager where email is the unique identifiers
    for authentication instead of usernames.
    """

    def create_user(self, email, password, **extra_fields):
        """
        Create and save a user with the given email and password.
        """
        if not email:
            raise ValueError(_("The Email must be set"))
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save()
        return user

    def create_superuser(self, email, password, **extra_fields):
        """
        Create and save a SuperUser with the given email and password.
        """
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        # extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError(_("Superuser must have is_staff=True."))
        if extra_fields.get("is_superuser") is not True:
            raise ValueError(_("Superuser must have is_superuser=True."))
        return self.create_user(email, password, **extra_fields)


class CustomUser(AbstractBaseUser, PermissionsMixin):
    """Custom User model - needed to use email as login and a few more additional fields"""

    email = models.EmailField(_("email address"), unique=True)
    first_name = models.CharField(max_length=30, null=False, blank=False)
    last_name = models.CharField(max_length=40, null=True, blank=True)
    gender = models.CharField(max_length=1, null=True, blank=True, choices=GENDER_CHOICES)

    username = models.CharField(max_length=40, null=True, blank=True)

    my_competitions = models.ManyToManyField('competition.Competition', blank=True, related_name='user')
    my_teams = models.ManyToManyField('competition.Team', blank=True, related_name='user')

    # personal 7 day goals
    goal_active_days = models.IntegerField(null=True, blank=True, default=3)
    goal_workout_minutes = models.IntegerField(null=True, blank=True, default=150)
    goal_distance = models.IntegerField(null=True, blank=True, default=None)

    # personal scaling factors
    scaling_kcal = models.DecimalField(null=False, blank=False, default=1, max_digits=8, decimal_places=4, validators=[
            MinValueValidator(Decimal('0.6666')),
            MaxValueValidator(Decimal('1.3333'))
        ]
    )
    scaling_distance = models.DecimalField(null=False, blank=False, default=1, max_digits=8, decimal_places=4, validators=[
            MinValueValidator(Decimal('0.6666')),
            MaxValueValidator(Decimal('1.3333'))
        ]
    )

    # has_paid = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)

    email_mid_week = models.BooleanField(default=False)

    strava_athlete_id = models.IntegerField(null=True, blank=True, unique=True)
    strava_allow_follow = models.BooleanField(default=True)
    strava_refresh_token = models.CharField(max_length=40, null=True, blank=True)
    strava_last_synced_at = models.DateTimeField(null=True, blank=True)

    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    date_joined = models.DateTimeField(default=timezone.now)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    objects = CustomUserManager()

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self):
        return self.email


    def __init__(self, *args, **kwargs):
        """ save initial field values to be able to detect changes """
        super().__init__(*args, **kwargs)
        self._original = self._dict()

    #@property
    def _dict(self):
        """ dict of current fields and values - to detect changes """
        return {f.name: round(float(self.__dict__[f.attname]), 2) if isinstance(self.__dict__.get(f.attname), (Decimal, float)) else self.__dict__.get(f.attname) for f in self._meta.fields}

    def get_changed_fields(self):
        """ check which fields have changed """
        current = self._dict()
        return {
            k: (v, current.get(k))
            for k, v in self._original.items()
            if v != current.get(k)
        }


    def save(self, *args, **kwargs):
        """ trigger recalculation of points_capped if workout changes """
        if self.username is None or self.username == "":
            if self.first_name is None or self.first_name == "":
                self.username = self.email.split("@")[0]
            elif self.last_name is None or self.last_name == "":
                self.username = self.first_name
            else:
                self.username = f'{self.first_name} {".".join([i[0] for i in self.last_name.replace("-"," ").split(" ") if len(i) >= 1])}.'

        is_create = self.pk is None
        super().save(*args, **kwargs)

        if is_create:
            eta = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=60 * 5)
            welcome_email.apply_async(args=[self.pk], eta=eta)

        changed = self.get_changed_fields()
        trigger_user_change(
            instance=self,
            new=is_create,
            changes=changed
        )
        self._original = self._dict()  # reset


@receiver(m2m_changed, sender=CustomUser.my_competitions.through)
def my_competitions_changed_handler(sender, instance, action, pk_set, **kwargs):
    if 'post' in action:
        if isinstance(instance, CustomUser):
            if 'add' in action:
                # instance user obj / pk_set comp id to add
                trigger_user_change(instance=instance, new=False, changes={'my_competitions': (None, list(pk_set))})
            elif 'remove' in action or 'clear' in action:
                # instance user obj / pk_set comp id to remove
                trigger_user_change(instance=instance, new=False, changes={'my_competitions': (list(pk_set), None)})
        else: # is instance of Competition
            for user_id in list(pk_set):
                user_obj = CustomUser.objects.get(pk=user_id)
                if 'add' in action:
                    # instance competition obj / pk_set user id to add
                    trigger_user_change(instance=user_obj, new=False, changes={'my_competitions': (None, [instance.pk])})
                elif 'remove' in action or 'clear' in action:
                    # instance competition obj / pk_set user id to remove
                    trigger_user_change(instance=user_obj, new=False, changes={'my_competitions': ([instance.pk], None)})



def get_strava_auth_url(user_id):
    """ Generate the initial auth url the user clicks, which will re-direct back to this page providing the code."""
    client_id = settings.STRAVA_CLIENT_ID
    redirect_url = f"{settings.MAIN_HOST}/strava/return/?user_id={user_id}"
    return f"https://www.strava.com/oauth/authorize?client_id={client_id}&response_type=code&approval_prompt=force&scope=profile:read_all,activity:read_all&redirect_uri={redirect_url}"


def make_url_qr_code(url, path):
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    img.save(path)



class RecalcRequest(models.Model):
    """ Recalc Request model to track which point caps need to be updated """

    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, null=False, blank=False)
    goal = models.ForeignKey('competition.ActivityGoal', on_delete=models.CASCADE, null=False, blank=False)
    start_datetime = models.DateTimeField(null=False, blank=False)
    done = models.BooleanField(default=False, null=False, blank=False)

    def __str__(self):
        return f'{self.goal} - {self.start_datetime}'