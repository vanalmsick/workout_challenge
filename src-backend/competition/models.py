import time, re, random
from decimal import Decimal

from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.core.validators import MinLengthValidator, RegexValidator
from django.core.exceptions import ValidationError

from workouts.models import Workout, SPORT_TYPE_GROUPS, SPORT_TYPES
from custom_user.models import CustomUser
from .scorer import trigger_goal_change, trigger_competition_change

# Create your models here.
COMPETITION_METRCIS = [
    ('min', 'Time (Minutes)'),
    ('num', 'Number of times (x)'),
    ('kcal', 'Calories (Kcal)'),
    ('km', 'Distance (Km)'),
    ('kj', 'Effort (Kilojoules)'),
]

POINT_REF_PERIODS = [
    ('day', 'daily'),
    ('week', 'weekly'),
    ('month', 'monthly'),
    ('year', 'yearly'),
    ('competition', 'competition end'),
]


class Competition(models.Model):
    """Competition users can compete in"""

    owner = models.ForeignKey(CustomUser, on_delete=models.CASCADE, null=False, blank=False)

    name = models.CharField(null=False, max_length=60)
    start_date = models.DateField(null=False)
    end_date = models.DateField(null=False)
    has_teams = models.BooleanField(default=False)
    organizer_assigns_teams = models.BooleanField(default=False)

    join_code = models.CharField(
        blank=False,
        null=False,
        max_length=20,
        validators=[
            MinLengthValidator(10),
            RegexValidator(r'^[a-zA-Z0-9]+$', message="Only letters and numbers allowed"),
        ],
        unique=True,
    )

    @property
    def start_date_fmt(self):
        return self.start_date.strftime("%a, %b %-d")

    @property
    def start_date_epoch(self):
        return int(time.mktime(self.start_date.timetuple()))

    @property
    def end_date_fmt(self):
        return self.end_date.strftime("%a, %b %-d")

    @property
    def end_date_epoch(self):
        return int(time.mktime(self.end_date.timetuple()))

    def __str__(self):
        """str print-out of model entry"""
        return f"{self.name} ({self.start_date} - {self.end_date})"

    def _coerce_dates(self):
        """ turn ISO date strings into real date objects

        Django does not convert field values on assignment, so a Competition built as
        ``Competition(start_date="2025-05-01")`` keeps a str in memory until it is re-read from the
        database. Everything downstream treats these as dates - ``trigger_goal_change`` does
        ``competition.end_date + timedelta(days=1)`` and ``trigger_competition_change`` compares the
        old and new value with ``<`` - so a str blows up with TypeError. Normalising here (before
        the change-detection snapshot is taken, and again on save) keeps the in-memory instance
        consistent with what the DB would hand back, whichever way it was constructed.
        """
        for field_name in ('start_date', 'end_date'):
            value = self.__dict__.get(field_name)
            if isinstance(value, str):
                # DateField.to_python parses ISO strings and raises ValidationError on garbage.
                setattr(self, field_name, self._meta.get_field(field_name).to_python(value))

    def __init__(self, *args, **kwargs):
        """ save initial field values to be able to detect changes """
        super().__init__(*args, **kwargs)
        # Must run before the snapshot, otherwise save() coercing str -> date would show up as a
        # spurious "start_date changed" and send a brand new competition down the resize branch of
        # trigger_competition_change (which would then compare a date against a str).
        self._coerce_dates()
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
        """ trigger recalculation of points_capped if competition changes """
        # catches dates assigned as strings after __init__ (comp.start_date = "2025-01-01")
        self._coerce_dates()
        is_create = self.pk is None
        if self.join_code == '':
            self.join_code = re.sub(r'[^a-zA-Z0-9]', '', self.name)[:8] + str(self.owner.pk).zfill(3) + str(random.randint(10_000, 99_999))
        self.join_code = self.join_code.upper()
        super().save(*args, **kwargs)
        changed = self.get_changed_fields()
        trigger_competition_change(
            instance=self,
            new=is_create,
            changes=changed
        )
        self._original = self._dict()  # reset

        # add default activity goals if new competition
        if is_create:
            ActivityGoal(name ='Exercise', competition = self, metric = 'min', goal = 150, period = 'week', max_per_day = 60, max_per_week = 240).save()  # WHO recommends at least 75-150 min vigorous activity per week (capped at 4h)
            ActivityGoal(name='Move', competition=self, metric='kcal', goal=1_800, period='week', max_per_day=1_000, max_per_week=3_000).save()  # 12kcal per minute
            self.owner.my_competitions.add(self) # add owner as participant


class Team(models.Model):
    """Competition teams users can join"""

    competition = models.ForeignKey(Competition, on_delete=models.CASCADE, null=False, blank=False)

    name = models.CharField(null=False, max_length=60)

    def clean(self):
        super().clean()
        #self.validate_members()


    # ToDo: Check if user is participant in competition he/she whats to join the team of
    #def validate_members(self):
    #    if self.competition.pk not in [member.competition.pk for member in self.members]:
    #        raise ValidationError({'member': 'User must have joined competition to be a team member of team.'})

    def __str__(self):
        """str print-out of model entry"""
        return f"{self.competition} - Team: {self.name}"


class ActivityGoal(models.Model):
    """Activity goals in Competition - user will earn points for each rule/category"""

    competition = models.ForeignKey(Competition, on_delete=models.CASCADE, null=False, blank=False)

    name = models.CharField(null=False, max_length=60)

    metric = models.CharField(null=False, max_length=4, choices=COMPETITION_METRCIS)
    goal = models.DecimalField(null=False, max_digits=10, decimal_places=2)
    period = models.CharField(null=False, max_length=12, default='day', choices=POINT_REF_PERIODS)

    count_steps_as_walks = models.BooleanField(default=True)

    min_per_workout = models.DecimalField(null=True, blank=True, max_digits=10, decimal_places=2)
    max_per_workout = models.DecimalField(null=True, blank=True, max_digits=10, decimal_places=2)
    min_per_day = models.DecimalField(null=True, blank=True, max_digits=10, decimal_places=2)
    max_per_day = models.DecimalField(null=True, blank=True, max_digits=10, decimal_places=2)
    min_per_week = models.DecimalField(null=True, blank=True, max_digits=10, decimal_places=2)
    max_per_week = models.DecimalField(null=True, blank=True, max_digits=10, decimal_places=2)

    def __str__(self):
        """str print-out of model entry"""
        return f"{self.competition}: {self.name} ({self.goal} {self.metric})"

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
        """ trigger recalculation of points_capped if goal changes """
        is_create = self.pk is None
        super().save(*args, **kwargs)
        changed = self.get_changed_fields()
        trigger_goal_change(
            instance=self,
            new=is_create,
            changes=changed
        )
        self._original = self._dict()  # reset




class Award(models.Model):
    """Awards in Competition - user can earn points for comppleting awards"""

    competition = models.ForeignKey(Competition, on_delete=models.CASCADE, null=False, blank=False)

    name = models.CharField(null=False, max_length=60)
    sport = models.CharField(null=False, default='GROUP_ANY', max_length=40, choices=SPORT_TYPE_GROUPS + SPORT_TYPES)
    threshold = models.DecimalField(null=False, max_digits=10, decimal_places=2)
    period = models.CharField(null=False, max_length=12, default='day', choices=POINT_REF_PERIODS)
    reward_points = models.IntegerField(null=False)

    def __str__(self):
        """str print-out of model entry"""
        return f"{self.competition}: {self.name} ({self.reward_points} {self.period})"



class Points(models.Model):
    """Points earned for User's Workout for this category or award"""

    goal = models.ForeignKey(ActivityGoal, on_delete=models.CASCADE, null=True, blank=True)
    award = models.ForeignKey(Award, on_delete=models.CASCADE, null=True, blank=True)
    workout = models.ForeignKey(Workout, on_delete=models.CASCADE, null=False, blank=False)

    points_raw = models.DecimalField(null=False, max_digits=10, decimal_places=2)
    points_capped = models.DecimalField(null=True, max_digits=10, decimal_places=2)

    class Meta:
        verbose_name = "Points"
        verbose_name_plural = "Points"
        constraints = [
            models.UniqueConstraint(fields=['goal', 'award', 'workout'], name='unique_goal_award_workout')
        ]

    def __str__(self):
        """str print-out of model entry"""
        return f"{self.award if self.goal is None else self.goal} - {self.points_raw}"