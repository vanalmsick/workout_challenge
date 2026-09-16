"""Deactivate long-inactive users."""

import datetime

from django.contrib.auth import get_user_model
from django.db.models import Max, Q
from django.utils import timezone

from workout_challenge.celery import app, single_instance

INACTIVE_DAYS = 90


@app.task(bind=True)
def deactivate_inactive_users(self):
    """Deactivate users who haven't logged in for 90+ days AND whose last competition ended 90+ days ago."""
    with single_instance('deactivate_inactive_users') as got_lock:
        if not got_lock:
            return 'Task already executing. Skipping.'

        cutoff_dt = timezone.now() - datetime.timedelta(days=INACTIVE_DAYS)
        cutoff_date = cutoff_dt.date()

        CustomUser = get_user_model()
        # users with no competitions at all (last_competition_end is None) count as "long finished" too
        updated = CustomUser.objects.filter(
            is_active=True,
            last_login__lt=cutoff_dt,
        ).annotate(
            last_competition_end=Max('my_competitions__end_date')
        ).filter(
            Q(last_competition_end__lt=cutoff_date) | Q(last_competition_end__isnull=True)
        ).update(is_active=False)

        print(f'Deactivated {updated} inactive users.')
        return updated
