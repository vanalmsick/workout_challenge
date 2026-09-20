import datetime, random
from openai import OpenAI
from django.core.cache import cache
from django.conf import settings
from django.apps import apps
from django.template.loader import render_to_string
from workout_challenge.celery import app
from django.db.models import Sum, Count, Max, Q
from django.db.models.functions import TruncDate, TruncDay
from django.utils import timezone

from .multipurpose import send_email
from competition.stats import get_competition_stats


@app.task()
def welcome_email(user_pk):
    """Welcome email for new users."""
    CustomUser = apps.get_model('custom_user', 'CustomUser')
    user_obj = CustomUser.objects.get(pk=user_pk)

    email_subject = 'Welcome to the Workout Challenge!'

    email_body = render_to_string(
        "email_welcome.html",
        {
            'first_name': user_obj.first_name,
            'MAIN_HOST': settings.MAIN_HOST,
            'EMAIL_REPLY_TO': settings.EMAIL_REPLY_TO[0] if settings.EMAIL_REPLY_TO is not None else settings.EMAIL_FROM,
            'link_strava_note': user_obj.strava_refresh_token is None or user_obj.strava_refresh_token == '',
        }
    )

    if settings.DEBUG:
        with open('tmp_email.html', 'w') as file:
            file.write(email_body)

    send_email(subject=email_subject, body=email_body, to_email=user_obj.email)

    return {'pk': user_obj.pk, 'username': user_obj.username, 'email': user_obj.email}


@app.task()
def send_all_log_workouts_email():
    print("Scheduling log workout emails...")
    CustomUser = apps.get_model('custom_user', 'CustomUser')
    user_lst = CustomUser.objects.filter(
        Q(my_competitions__start_date__lte=datetime.date.today()) &
        Q(my_competitions__end_date__gte=datetime.date.today())
    ).order_by('pk').distinct()
    task_log = []
    if len(user_lst) > 0:
        eta_steps = max(min((60 * 60) // len(user_lst), 60), 10)
        eta = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=10)
        for user_obj in user_lst:
            result = log_workouts_email.apply_async(args=[user_obj.pk], eta=eta)
            task_log.append({'pk': user_obj.pk, 'username': user_obj.username, 'email': user_obj.email, 'task_id': result.task_id, 'eta': eta.isoformat()})
            eta += datetime.timedelta(seconds=eta_steps)
    return task_log


@app.task()
def log_workouts_email(user_pk):
    """Email reminder for users to please log their workouts."""
    CustomUser = apps.get_model('custom_user', 'CustomUser')
    user_obj = CustomUser.objects.get(pk=user_pk)
    workout_obj_lst = user_obj.workout_set.order_by('-start_datetime')[:3]

    email_subject = 'Workout Challenge - Log Your Workouts!'

    email_body = render_to_string(
        "email_log_workouts.html",
        {
            'first_name': user_obj.first_name,
            'last_workouts': workout_obj_lst,
            'link_strava_note': user_obj.strava_refresh_token is None or user_obj.strava_refresh_token == '',
            'MAIN_HOST': settings.MAIN_HOST,
            'EMAIL_REPLY_TO': settings.EMAIL_REPLY_TO[0] if settings.EMAIL_REPLY_TO is not None else settings.EMAIL_FROM,
        }
    )

    if settings.DEBUG:
        with open('tmp_email.html', 'w') as file:
            file.write(email_body)

    send_email(subject=email_subject, body=email_body, to_email=user_obj.email)

    return {'pk': user_obj.pk, 'username': user_obj.username, 'email': user_obj.email}


@app.task()
def send_all_competition_start_email():
    print("Scheduling competition start emails...")
    Competition = apps.get_model('competition', 'Competition')
    competition_lst = Competition.objects.filter(start_date=datetime.date.today() + datetime.timedelta(days=1)).order_by('pk').distinct()
    task_log = []
    for i, competition_obj in enumerate(competition_lst):
        eta = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=10) + datetime.timedelta(minutes=(15 * i))
        user_lst = competition_obj.user.all().order_by('pk').distinct()
        if len(user_lst) > 0:
            eta_steps = max(min((60 * 60) // len(user_lst), 60), 10)
            for user_obj in user_lst:
                result = competition_start_email.apply_async(args=[competition_obj.pk, user_obj.pk], eta=eta)
                task_log.append({'user_pk': user_obj.pk, 'username': user_obj.username, 'email': user_obj.email, 'competition_pk': competition_obj.pk, 'competition_name': competition_obj.name, 'task_id': result.task_id, 'eta': eta.isoformat()})
                eta += datetime.timedelta(seconds=eta_steps)
    return task_log


@app.task()
def competition_start_email(competition_pk, user_pk):
    """Email for competition start tomorrow."""
    Competition = apps.get_model('competition', 'Competition')
    competition_obj = Competition.objects.get(pk=competition_pk)
    goal_objs = competition_obj.activitygoal_set.all()

    CustomUser = apps.get_model('custom_user', 'CustomUser')
    user_obj = CustomUser.objects.get(pk=user_pk)

    email_subject = 'Workout Challenge - READY, SET, GO!'

    email_body = render_to_string(
        "email_competition_start.html",
        {
            'first_name': user_obj.first_name,
            'MAIN_HOST': settings.MAIN_HOST,
            'competition': competition_obj,
            'goals': goal_objs,
            'EMAIL_REPLY_TO': settings.EMAIL_REPLY_TO[0] if settings.EMAIL_REPLY_TO is not None else settings.EMAIL_FROM,
            'goal_equalizer_note': user_obj.scaling_kcal == 1 and user_obj.scaling_distance == 1,
        }
    )

    if settings.DEBUG:
        with open('tmp_email.html', 'w') as file:
            file.write(email_body)

    send_email(subject=email_subject, body=email_body, to_email=user_obj.email)

    return ({'pk': user_obj.pk, 'username': user_obj.username, 'email': user_obj.email})


@app.task()
def send_all_leaderboard_emails():
    print("Scheduling leaderboard emails...")
    CustomUser = apps.get_model('custom_user', 'CustomUser')
    user_lst = CustomUser.objects.filter(my_competitions__start_date__lt=datetime.date.today(), my_competitions__end_date__gte=datetime.date.today()).order_by('pk').distinct()
    task_log = []
    if len(user_lst) > 0:
        eta_steps = max(min((60 * 60) // len(user_lst), 60), 10)
        eta = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=10)
        for user_obj in user_lst:
            result = leaderboard_email.apply_async(args=[user_obj.pk], eta=eta)
            task_log.append({'pk': user_obj.pk, 'username': user_obj.username, 'email': user_obj.email, 'task_id': result.task_id, 'eta': eta.isoformat()})
            eta += datetime.timedelta(seconds=eta_steps)
    return task_log


def _prep_leaderboard(leaderboard, user_pk):
    """Hide participants without any points and mark the recipient's own row."""
    return {
        'individual': [{**i, 'is_me': i['id'] == user_pk} for i in leaderboard['individual'] if i.get('total_capped')],
        'team': [{**i, 'is_me': any(m['id'] == user_pk for m in i.get('members', []))} for i in leaderboard['team']],
    }


@app.task()
def leaderboard_email(user_pk):
    """Email to send users their leaderboard."""
    CustomUser = apps.get_model('custom_user', 'CustomUser')
    user_obj = CustomUser.objects.get(pk=user_pk)

    competition_all_data = []
    competition_7d_data = []

    for competition in user_obj.my_competitions.filter(start_date__lte=datetime.date.today(), end_date__gte=datetime.date.today()).order_by('-start_date'):
        competition_all_stats = get_competition_stats(competition.pk)
        competition_all_data.append({
            'competition': competition_all_stats['competition'],
            'leaderboard': _prep_leaderboard(competition_all_stats['leaderboard'], user_obj.pk),
        })
        competition_7d_stats = get_competition_stats(competition.pk, last_seven_days=True)
        competition_7d_data.append({
            'competition': competition_7d_stats['competition'],
            'leaderboard': _prep_leaderboard(competition_7d_stats['leaderboard'], user_obj.pk),
        })

    email_subject = 'Workout Challenge - Your Spot on the Leaderboard!'

    email_body = render_to_string(
        "email_leaderboard.html",
        {
            'first_name': user_obj.first_name,
            'MAIN_HOST': settings.MAIN_HOST,
            'competitions_all': competition_all_data,
            'competitions_7d': competition_7d_data,
            'EMAIL_REPLY_TO': settings.EMAIL_REPLY_TO[0] if settings.EMAIL_REPLY_TO is not None else settings.EMAIL_FROM,
            'goal_equalizer_note': user_obj.scaling_kcal == 1 and user_obj.scaling_distance == 1,
        }
    )

    if settings.DEBUG:
        with open('tmp_email.html', 'w') as file:
            file.write(email_body)

    send_email(subject=email_subject, body=email_body, to_email=user_obj.email)

    return ({'pk': user_obj.pk, 'username': user_obj.username, 'email': user_obj.email})


@app.task()
def send_all_weekly_emails():
    print("Scheduling weekly emails...")
    CustomUser = apps.get_model('custom_user', 'CustomUser')
    user_lst = CustomUser.objects.filter(email_mid_week=True, is_active=True).order_by('pk').distinct()
    task_log = []
    if len(user_lst) > 0:
        eta_steps = max(min((60 * 60) // len(user_lst), 60), 10)
        eta = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=10)
        for user_obj in user_lst:
            result = weekly_email.apply_async(args=[user_obj.pk], eta=eta)
            task_log.append({'pk': user_obj.pk, 'username': user_obj.username, 'email': user_obj.email, 'task_id': result.task_id, 'eta': eta.isoformat()})
            eta += datetime.timedelta(seconds=eta_steps)
    return task_log


def openai_quote():

    if settings.OPENAI_API_KEY is None:
        return None

    todays_ai_quote = cache.get('todays_ai_quote', None)

    if todays_ai_quote is None:
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        options = ["fitness", "health", "nutritional", "workout"]
        selection = random.choice(options)
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "user", "content": f"Tell me a one sentence {selection} fact."},
            ],
            temperature=1.0,
            top_p=1.0
        )
        todays_ai_quote = response.choices[0].message.content
        cache.set('todays_ai_quote', todays_ai_quote, 60 * 60 * 20)

        print('Todays AI Quote:', todays_ai_quote)

    return todays_ai_quote


def calendar_stats(user_pk):
    today = datetime.date.today()

    # Step 1: Find next Sunday (or today if Sunday)
    days_until_sunday = (6 - today.weekday()) % 7  # weekday(): Monday=0, Sunday=6
    next_sunday = today + datetime.timedelta(days=days_until_sunday)

    # Step 2: Create list of days going back 5 weeks (inclusive)
    dates_list = [next_sunday - datetime.timedelta(days=i) for i in range(34, -1, -1)]

    Workout = apps.get_model('workouts', 'Workout')
    all_workouts = Workout.objects.filter(user=user_pk).annotate(date=TruncDay('start_datetime')).values('date').annotate(count=Count('id'))
    workouts_by_date = {row['date'].date().isoformat(): row['count'] for row in all_workouts}
    workouts_by_week = {(settings.TIME_ZONE_OBJ.localize(datetime.datetime.combine(next_sunday, datetime.datetime.min.time())) - row['date']).days // 7: True for row in all_workouts}

    streak_weeks = 0
    streak_i = 0
    streak_true = True
    while streak_true:
        if workouts_by_week.get(streak_i, False):
            streak_weeks += 1
        elif streak_i == 0:
            pass
        else:
            streak_true = False
        streak_i += 1

    return_calendar = []
    for date in dates_list:
        workout_num = workouts_by_date.get(date.isoformat(), 0)
        return_calendar.append({
            'datetime': date,
            'day': date.day,
            'workout_num': workout_num,
            'color': '#FFFFFF' if date == today or workout_num > 0 else ('#D1D5DB' if date > today else '#111827'),
            'background_color': '#DC2626' if date == today else ('#075985' if workout_num > 0 else '#FFFFFF')
        })

    return streak_weeks, [return_calendar[i:i+7] for i in range(0, len(return_calendar), 7)]


@app.task()
def weekly_email(user_pk):
    """Email to send users their weekly update."""
    CustomUser = apps.get_model('custom_user', 'CustomUser')
    user_obj = CustomUser.objects.get(pk=user_pk)

    Workout = apps.get_model('workouts', 'Workout')
    workout_7day_stats = Workout.objects.filter(
        user=user_obj,
        start_datetime__gte=datetime.date.today() - datetime.timedelta(days=7)
    ).annotate(
        day=TruncDate('start_datetime')
    ).aggregate(
        total_duration=Sum('duration'),
        total_distance=Sum('distance'),
        distinct_days=Count('day', distinct=True)
    )

    week_streak, calendar = calendar_stats(user_pk)

    todays_ai_quote = openai_quote()

    email_subject = 'Workout Challenge - Your Weekly Update!'

    recorded_total_duration = 0 if workout_7day_stats["total_duration"] is None else (workout_7day_stats["total_duration"].seconds // 60)
    recorded_total_distance = 0 if workout_7day_stats["total_distance"] is None else workout_7day_stats["total_distance"]
    recorded_distinct_days = 0 if workout_7day_stats["distinct_days"] is None else workout_7day_stats["distinct_days"]

    email_body = render_to_string(
        "email_weekly.html",
        {
            'first_name': user_obj.first_name,
            'MAIN_HOST': settings.MAIN_HOST,
            'calendar': calendar,
            'week_streak': week_streak,
            'goals': {
                'active_days': None if user_obj.goal_active_days is None or user_obj.goal_active_days == '' else {'recorded': recorded_distinct_days,'target': user_obj.goal_active_days, 'percent': min(1, recorded_distinct_days / user_obj.goal_active_days) * 100},
                'distance': None if user_obj.goal_distance is None or user_obj.goal_distance == '' else {'recorded': recorded_total_distance,'target': user_obj.goal_distance, 'percent': min(1, recorded_total_distance / user_obj.goal_distance) * 100},
                'minutes': None if user_obj.goal_workout_minutes is None or user_obj.goal_workout_minutes == '' else {'recorded': recorded_total_duration,'target': user_obj.goal_workout_minutes, 'percent': min(1, recorded_total_duration / user_obj.goal_workout_minutes) * 100},
            },
            'openai_quote': todays_ai_quote,
            'EMAIL_REPLY_TO': settings.EMAIL_REPLY_TO[0] if settings.EMAIL_REPLY_TO is not None else settings.EMAIL_FROM,
        }
    )

    if settings.DEBUG:
        with open('tmp_email.html', 'w') as file:
            file.write(email_body)

    send_email(subject=email_subject, body=email_body, to_email=user_obj.email)

    return {'pk': user_obj.pk, 'username': user_obj.username, 'email': user_obj.email}


# Deactivated users get a nudge every 24 weeks (~6 months) since they last used the app.
INACTIVE_REMINDER_WEEKS = 24


def weeks_since_last_activity(user_obj, last_competition_end=None):
    """Whole weeks since the later of the user's last login and their last competition's end date.

    Pass last_competition_end when the caller already annotated it, to avoid a query per user.
    """
    dates = []
    if user_obj.last_login is not None:
        dates.append(timezone.localtime(user_obj.last_login).date())
    if last_competition_end is None:
        last_competition_end = user_obj.my_competitions.aggregate(end=Max('end_date'))['end']
    if last_competition_end is not None:
        dates.append(last_competition_end)
    if len(dates) == 0:
        # Never logged in and never joined a competition - fall back to when they signed up.
        dates.append(timezone.localtime(user_obj.date_joined).date())

    return (datetime.date.today() - max(dates)).days // 7


@app.task()
def send_all_account_inactive_emails():
    """Schedule the come-back-or-close-up email for every deactivated user that is due one."""
    print("Scheduling account inactive emails...")
    CustomUser = apps.get_model('custom_user', 'CustomUser')
    user_lst = CustomUser.objects.filter(is_active=False).annotate(
        last_competition_end=Max('my_competitions__end_date')
    ).order_by('pk').distinct()

    due_lst = []
    for user_obj in user_lst:
        weeks = weeks_since_last_activity(user_obj, user_obj.last_competition_end)
        if weeks > 0 and weeks % INACTIVE_REMINDER_WEEKS == 0:
            due_lst.append(user_obj)

    task_log = []
    if len(due_lst) > 0:
        eta_steps = max(min((60 * 60) // len(due_lst), 60), 10)
        eta = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=10)
        for user_obj in due_lst:
            result = account_inactive_email.apply_async(args=[user_obj.pk], eta=eta)
            task_log.append({'pk': user_obj.pk, 'username': user_obj.username, 'email': user_obj.email, 'task_id': result.task_id, 'eta': eta.isoformat()})
            eta += datetime.timedelta(seconds=eta_steps)
    return task_log


@app.task()
def account_inactive_email(user_pk):
    """Email a dormant user: come back and start a competition, or log in and delete the account."""
    CustomUser = apps.get_model('custom_user', 'CustomUser')
    user_obj = CustomUser.objects.get(pk=user_pk)

    inactive_months = max(6, (weeks_since_last_activity(user_obj) // INACTIVE_REMINDER_WEEKS) * 6)

    email_subject = 'Workout Challenge - Still Up for a Challenge?'

    email_body = render_to_string(
        "email_account_inactive.html",
        {
            'first_name': user_obj.first_name,
            'MAIN_HOST': settings.MAIN_HOST,
            'inactive_months': inactive_months,
            'EMAIL_REPLY_TO': settings.EMAIL_REPLY_TO[0] if settings.EMAIL_REPLY_TO is not None else settings.EMAIL_FROM,
        }
    )

    if settings.DEBUG:
        with open('tmp_email.html', 'w') as file:
            file.write(email_body)

    send_email(subject=email_subject, body=email_body, to_email=user_obj.email)

    return {'pk': user_obj.pk, 'username': user_obj.username, 'email': user_obj.email, 'inactive_months': inactive_months}
