import datetime

from django.conf import settings
from django.apps import apps
from rest_framework.response import Response
from rest_framework import status

from django.db.models import Sum, Count, ExpressionWrapper, DurationField, F, Q, IntegerField
from django.db.models.functions import TruncDay, Now, ExtractDay


def _add_rank(data, key, enhance_dict, id_field, rank_field='rank', reverse=True):
    sorted_data = sorted(data, key=lambda x: x[key], reverse=reverse)
    rank = 0
    last_value = None
    user_lst = []
    for idx, item in enumerate(sorted_data, start=1):
        if item[key] != last_value:
            rank = idx
            last_value = item[key]
        sorted_data[idx-1] = {**item, rank_field: rank, **enhance_dict[item[id_field]]}
        enhance_dict[item[id_field]]['rank'] = rank
        enhance_dict[item[id_field]]['points'] = item[key]
        user_lst.append(item[id_field])
    for i in [i for i in enhance_dict.keys() if i not in user_lst]:
        sorted_data.append({**enhance_dict[i], rank_field: None, key: None})
        enhance_dict[i]['rank'] = None
        enhance_dict[i]['points'] = None
    return sorted_data


def get_competition_stats(competition, last_seven_days=False):
    CustomUser = apps.get_model('custom_user', 'CustomUser')
    Competition = apps.get_model('competition', 'Competition')
    Points = apps.get_model('competition', 'Points')
    Team = apps.get_model('competition', 'Team')

    # Custom query logic
    try:
        competition_obj = Competition.objects.get(id=competition)
    except Competition.DoesNotExist:
        return Response({"detail": "Competition not found."}, status=status.HTTP_404_NOT_FOUND)
    all_points = Points.objects.filter(Q(award__competition__id=competition) | Q(goal__competition_id=competition))

    if last_seven_days:
        today = datetime.date.today()
        last_sunday = today - datetime.timedelta(days=today.weekday() + 1) if today.weekday() != 6 else today
        monday_before = last_sunday - datetime.timedelta(days=6)
        all_points = all_points.filter(workout__start_datetime__gte=monday_before, workout__start_datetime__lt=last_sunday + datetime.timedelta(days=1))

    # For SQLite
    if settings.DATABASES.get('default', {}).get('ENGINE') == 'django.db.backends.sqlite3':
        all_points_date = (
            all_points
            .annotate(date=TruncDay('workout__start_datetime'))
            .annotate(tmp_today=TruncDay(Now()))
            .annotate(tmp_start_date=TruncDay(F('workout__start_datetime')))
            .annotate(days_ago=ExpressionWrapper((F('tmp_today') - F('tmp_start_date')) / 86_400_000_000, output_field=IntegerField()))
        )
    # For Postgres
    else:
        all_points_date = (
            all_points
            .annotate(date=TruncDay('workout__start_datetime'))
            .annotate(days_ago_duration=ExpressionWrapper(TruncDay(Now()) - TruncDay(F('workout__start_datetime')), output_field=DurationField()))
            .annotate(days_ago=ExtractDay(F('days_ago_duration')))
        )
    tmp_all = (
        all_points_date
        .values('days_ago')
        .annotate(total=Sum('points_capped'))
        .values('days_ago', 'total')
        .order_by('-days_ago')
    )
    timeseries_all = {}
    for i in tmp_all:
        days_ago = i.pop('days_ago')
        timeseries_all[days_ago] = i

    tmp_user = (
        all_points_date
        .values('days_ago', 'workout__user__id')
        .annotate(total=Sum('points_capped'))
        .order_by('-days_ago')
    )
    timeseries_user = {}
    for i in tmp_user:
        user_id = i.pop('workout__user__id')
        days_ago = i.pop('days_ago')
        if user_id not in timeseries_user:
            timeseries_user[user_id] = {}
        timeseries_user[user_id][days_ago] = i

    tmp_team = (
        all_points_date
        .values('days_ago', 'workout__user__my_teams')
        .annotate(total=Sum('points_capped'))
        .order_by('-days_ago')
    )
    timeseries_team = {}
    for i in tmp_team:
        team_id = i.pop('workout__user__my_teams')
        days_ago = i.pop('days_ago')
        if team_id not in timeseries_team:
            timeseries_team[team_id] = {}
        timeseries_team[team_id][days_ago] = i

    # Get user data
    user_dict = {i['id']: i for i in CustomUser.objects.filter(my_competitions=competition).values('id', 'username', 'strava_allow_follow', 'strava_athlete_id').order_by('username', 'id')}
    for key, value in user_dict.items():
        if value['strava_allow_follow'] is False:
            value['strava_athlete_id'] = None

    # Get user rankings
    leaderboard_user = (
        all_points
        .values('workout__user__id')
        .annotate(total_capped=Sum('points_capped'))
        .order_by('-total_capped')
    )
    leaderboard_user = _add_rank(leaderboard_user, key="total_capped", enhance_dict=user_dict, id_field='workout__user__id')
    leaderboard_user_dict = {i['id']: i for i in leaderboard_user}

    # Get team data
    team_dict = {i.id: {'id': i.id, 'name': i.name, 'members': [leaderboard_user_dict.get(i.id, {'id': i.id, 'username': 'ERROR', 'total_capped': None}) for i in i.user.all()]} for i in Team.objects.filter(competition=competition).prefetch_related('user')}
    for key, value in team_dict.items():
        value['active_member_count'] = sum(1 for i in value.get('members', []) if i.get('total_capped', 0) is not None and i.get('total_capped', 0) > 0)
        value['member_count'] = len(value.get('members', []))

    # Get team rankings
    leaderboard_team = (
        all_points
        .values('workout__user__my_teams__id')
        .annotate(total_capped=Sum('points_capped'))
        .order_by('-total_capped')
    )
    leaderboard_team = [{**i, 'total_capped': i['total_capped'] / max(1, team_dict[i['workout__user__my_teams__id']]['active_member_count'])} for i in leaderboard_team if i['workout__user__my_teams__id'] in team_dict]
    leaderboard_team = _add_rank(leaderboard_team, key="total_capped", enhance_dict=team_dict, id_field='workout__user__my_teams__id')
    team_dict = {i['id']: i for i in leaderboard_team}

    competition_details = {
        'name': competition_obj.name,
        'owner': user_dict.get(competition_obj.owner.pk, {'id': competition_obj.owner.pk, 'username': 'ERROR', 'total_capped': None}),
        'members': [user_dict.get(i, {'id': i, 'username': 'ERROR', 'total_capped': None}) for i in list(competition_obj.user.all().values_list('pk', flat=True))],
        'member_count': competition_obj.user.all().count(),
        'active_member_count': len(timeseries_user),
        'start_date': competition_obj.start_date,
        'start_date_count': (datetime.date.today() - competition_obj.start_date).days,
        'end_date': competition_obj.end_date,
        'end_date_count': (datetime.date.today() - competition_obj.end_date).days,
        'has_teams': competition_obj.has_teams,
        'goals': list(competition_obj.activitygoal_set.all().values()),  # list, not a QuerySet - this dict gets cached
    }

    response_obj = {
        'competition': competition_details,
        'users': user_dict,
        'teams': team_dict,
        'timeseries': {
            'all': timeseries_all,
            'user': timeseries_user,
            'team': timeseries_team,
        },
        'leaderboard': {
            'team': leaderboard_team,
            'individual': leaderboard_user,
        }
    }
    return response_obj
