"""Celery task config"""

import os

from celery import Celery
from celery.schedules import crontab

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "workout_challenge.settings")

app = Celery("workout_challenge")

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
# - namespace='CELERY' means all celery-related configuration keys
#   should have a `CELERY_` prefix.
app.config_from_object("django.conf:settings", namespace="CELERY")

# Load task modules from all registered Django apps.
app.autodiscover_tasks()

app.conf.beat_schedule = {
    # every morning import users strava workouts
    "strava_sync": {
        "task": "custom_user.strava.daily_strava_sync",
        "schedule": crontab(minute="44", hour="4"),
        "args": (),
    },
    # not needed - just fallback - do all pending point recalc tasks in the morning
    "point_recal": {
        "task": "custom_user.point_recalc.recalc_points",
        "schedule": crontab(minute="55", hour="5"),
        "args": (),
    },
    # every Monday morning ask people who didn't connect Strava to please log their workouts
    "send_all_log_workouts_email": {
        "task": "custom_user.emails.celery_emails.send_all_log_workouts_email",
        "schedule": crontab(day_of_week="1", minute="5", hour="9"),
        "args": (),
    },
    # every Monday afternoon send competition leaderboards out
    "send_all_leaderboard_emails": {
        "task": "custom_user.emails.celery_emails.send_all_leaderboard_emails",
        "schedule": crontab(day_of_week="1", minute="5", hour="15"),
        "args": (),
    },
    # every Thursday afternoon send weekly check-ins out
    "send_all_weekly_emails": {
        "task": "custom_user.emails.celery_emails.send_all_weekly_emails",
        "schedule": crontab(day_of_week="4", minute="5", hour="15"),
        "args": (),
    },
    # every day at noon send start competition email
    "send_all_competition_start_email": {
        "task": "custom_user.emails.celery_emails.send_all_competition_start_email",
        "schedule": crontab(minute="5", hour="12"),
        "args": (),
    },
}


class single_instance:
    """Context manager guaranteeing only one copy of a task runs at a time.

    Replaces the previous ``app.control.inspect().active()`` check. That call broadcast over the
    pidbox and created a fresh per-call reply queue in redis every time it ran; those reply keys
    accumulate in the broker, and it also blocked for the full inspect timeout and raised
    AttributeError whenever no worker replied (``active()`` returns None).

    This uses the Django cache (redis) instead: one atomic ``add`` for the lock, released on
    ``__exit__`` (so it is freed on exceptions and on ``self.retry()`` too), with a TTL so a
    hard-killed worker can never leave the lock stuck.

        with single_instance('recalc_points') as got_lock:
            if not got_lock:
                return 'Skipped because it is already running.'
            ...
    """

    def __init__(self, task_name: str, timeout: int = 60 * 30):
        self.key = f"task_lock_{task_name}"
        self.timeout = timeout
        self.acquired = False

    def __enter__(self) -> bool:
        from django.core.cache import cache

        # cache.add is a no-op (returns False) if the key already exists -> atomic lock.
        self.acquired = cache.add(self.key, "1", self.timeout)
        return self.acquired

    def __exit__(self, exc_type, exc_value, traceback):
        if self.acquired:
            from django.core.cache import cache

            cache.delete(self.key)
        return False