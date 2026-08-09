import requests
import time, datetime

from django.core.cache import cache
from django.contrib.auth import get_user_model
from django.conf import settings
from django.utils import timezone
from rest_framework.response import Response
from rest_framework import status
from django.db import IntegrityError
from workout_challenge.celery import app, single_instance
from django.db.models import Q

from workouts.models import Workout
from .api_rate_limiter import strava_api_monitor, RateLimitExceeded  # Import to trigger initialization


def _seconds_until_next_interval():
    current_time = time.localtime()
    minutes = current_time.tm_min
    seconds = current_time.tm_sec

    # Calculate the next interval (15, 30, 45, or 0 of the next hour)
    next_interval = (minutes // 15 + 1) * 15
    if next_interval == 60:  # Handle the case where it rolls over to the next hour
        next_interval = 0

    # Calculate the seconds until the next interval
    seconds_until = (next_interval - minutes) * 60 - seconds
    if next_interval == 0:  # Adjust for the next hour
        seconds_until += 3600

    return seconds_until


@app.task(bind=True, time_limit=60 * 60 * 3, max_retries=10)  # 3 hour time limit
def daily_strava_sync(self, refresh_all=False):
    with single_instance('daily_strava_sync', timeout=60 * 60 * 3) as got_lock:
        if not got_lock:
            return 'Task already executing. Skipping.'

        CustomUser = get_user_model()
        user_lst = CustomUser.objects.filter(
            strava_refresh_token__isnull=False,
            is_active=True
        )
        if refresh_all is False:
            user_lst = user_lst.filter(
                Q(strava_last_synced_at__lt=timezone.now() - datetime.timedelta(hours=6)) |
                Q(strava_last_synced_at__isnull=True)
            )
        user_lst = user_lst.order_by('strava_last_synced_at', 'pk')

        # Only the ids/labels are needed here - don't keep full CustomUser instances alive for the
        # whole (up to 3 hour) sync loop.
        user_lst_names = list(user_lst.values('pk', 'username', 'email'))
        print(f'Syncing Strava for {len(user_lst_names)} users: {user_lst_names}')

        for user in user_lst_names:
            try:
                sync_strava(user__id=user['pk'])
            except RateLimitExceeded as exc:
                sleep_time = _seconds_until_next_interval() + 60
                print(f'Strava sync rate limit exceeded - sleeping for {sleep_time // 60 } mins')
                raise self.retry(exc=exc, countdown=sleep_time)  # retry in next Strava 15min api period
            except Exception as exc:
                print(f'Strava sync failed for user {user["email"]} - {exc}')

        print('Finished syncing Strava.')
        return user_lst_names



@app.task(bind=True)
def sync_strava(self, user__id, start_datetime=None):
    access_token = cache.get(f"strava_access_token_{user__id}")
    CustomUser = get_user_model()
    user = CustomUser.objects.get(id=user__id)

    # Only this user's already-imported Strava ids. Previously this was
    # ``set(Workout.objects.all().values_list('strava_id', flat=True))`` - every workout row in the
    # entire database (including the manually-logged ones, whose strava_id is None), rebuilt for
    # every user on every sync. That set grew linearly with total app usage and, because prefork
    # children were never recycled, its peak stayed resident in the worker forever.
    all_existing_strava_activities = set(
        Workout.objects
        .filter(user=user, strava_id__isnull=False)
        .values_list('strava_id', flat=True)
    )

    cnt_new_strava_activities = 0
    cnt_updated_strava_activities = 0

    if strava_api_monitor.ok_workout_requests() is False:
        raise RateLimitExceeded("No Strava Workout API requests allowed anymore to keep enough balance for user linkage")

    # refresh access token if expired
    if access_token is None:
        refresh_token = user.strava_refresh_token
        client_id = settings.STRAVA_CLIENT_ID
        client_secret = settings.STRAVA_CLIENT_SECRET

        response = requests.post(
            url='https://www.strava.com/oauth/token',
            data={
                'client_id': client_id,
                'client_secret': client_secret,
                'grant_type': 'refresh_token',
                'refresh_token': refresh_token,
            }
        )
        strava_api_monitor.log_request(response)
        response.raise_for_status()

        strava_tokens = response.json()
        access_token = strava_tokens.get('access_token', None)
        cache.set(f"strava_access_token_{user__id}", access_token, int(strava_tokens.get('expires_in', 21600)) - 60)


    # get activities
    page = 1
    per_page = 200
    while True:
        if strava_api_monitor.ok_workout_requests() is False:
            raise RateLimitExceeded("No Strava Workout API requests allowed anymore to keep enough balance for user linkage")

        response = requests.get(
            url='https://www.strava.com/api/v3/athlete/activities',
            headers={
                'Authorization': f'Bearer {access_token}',
            },
            params={
                'after': None if start_datetime is None else int(start_datetime.timestamp()),
                'page': page,
                'per_page': per_page,
            }
        )
        strava_api_monitor.log_request(response)
        response.raise_for_status()
        activities = response.json()

        for activity in activities:
            activity_id = activity.get('id')

            props = {
                'user': user,
                'strava_id': activity_id,
                'sport_type': activity.get('sport_type'),
                'start_datetime': datetime.datetime.fromisoformat(activity.get('start_date')),
                'duration': datetime.timedelta(seconds=activity.get('moving_time')),
                'distance': None if activity.get('distance') == 0 else activity.get('distance') / 1_000,
            }

            # if existing workout - update activity details
            if activity_id in all_existing_strava_activities:
                workout = Workout.objects.get(user=user, strava_id=activity_id)
                for key, value in props.items():
                    setattr(workout, key, value)
                workout.save()
                cnt_updated_strava_activities += 1

            # if a new workout - get activity details
            else:
                if strava_api_monitor.ok_workout_requests() is False:
                    raise RateLimitExceeded("No Strava Workout API requests allowed anymore to keep enough balance for user linkage")

                response = requests.get(
                    url=f'https://www.strava.com/api/v3/activities/{activity_id}',
                    headers={
                        'Authorization': f'Bearer {access_token}',
                    },
                )
                strava_api_monitor.log_request(response)
                response.raise_for_status()
                activity_details = response.json()

                avg_heart_rate = activity_details.get('average_heartrate', 0)
                props['kcal'] = kcal = activity_details.get('calories', activity_details.get('kilojoules', 0) / 4.18)
                props['strava_intensity_avg_watts'] = avg_watt = activity_details.get('average_watts', 0)

                # estimate intensity
                max_heart_rate = 180
                kcal_per_ten_minute = kcal / (max(activity.get('moving_time', 60 * 30), 60) / (60 * 10))
                if avg_heart_rate > max_heart_rate * 0.85 or kcal_per_ten_minute > 120 or avg_watt > 300:
                    props['intensity_category'] = 4
                elif avg_heart_rate > max_heart_rate * 0.70 or kcal_per_ten_minute > 90 or avg_watt > 275:
                    props['intensity_category'] = 3
                elif avg_heart_rate > max_heart_rate * 0.60 or kcal_per_ten_minute > 75 or avg_watt > 225:
                    props['intensity_category'] = 2
                else:
                    props['intensity_category'] = 1

                Workout.objects.create(**props)
                cnt_new_strava_activities += 1

        if len(activities) < per_page:
            break
        page += 1

    strava_last_synced_at = timezone.now()
    if start_datetime is None:
        setattr(user, 'strava_last_synced_at', strava_last_synced_at)
        user.save()
    print(f'User {user__id} - fetched {cnt_new_strava_activities} new strava activities and updated {cnt_updated_strava_activities} existing strava activities')

    return {'user': user__id, 'total_activities': (page - 1) * per_page + len(activities), 'new_activities': cnt_new_strava_activities, 'updated_activities': cnt_updated_strava_activities, 'sync_time': strava_last_synced_at}