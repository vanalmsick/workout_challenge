import datetime
from django.apps import apps

from custom_user.point_recalc import trigger_recalc_points


def _calculate_points_raw(goal, workout, user):
    goal_metric = goal.metric
    goal_target = float(goal.goal)

    if goal_metric == 'min':
        if workout.duration is None or workout.duration == '':
            points = 0
        else:
            points = float(workout.duration.total_seconds()) / 60 / goal_target
    elif goal_metric == 'num':
        points = 1 / goal_target
    elif goal_metric == 'kcal':
        if workout.kcal is None or workout.kcal == '':
            points = 0
        else:
            points = float(workout.kcal) / (goal_target * float(user.scaling_kcal))
    elif goal_metric == 'km':
        if workout.distance is None or workout.distance == '':
            points = 0
        else:
            points = float(workout.distance) / (goal_target * float(user.scaling_distance))
    elif goal_metric == 'kj':
        if workout.kcal is None or workout.kcal == '':
            points = 0
        else:
            points = float(workout.kcal) * 4.18 / (goal_target * float(user.scaling_kcal))
    return points * 100


def trigger_workout_delete(instance):
    RecalcRequest = apps.get_model('custom_user', 'RecalcRequest')
    for points in instance.points_set.all():
        RecalcRequest(user=instance.user, goal=points.goal, start_datetime=instance.start_datetime).save()
    print(f"Workout ({instance.pk}) deletion triggered point cap recalc - after {instance.start_datetime.isoformat()}")

    trigger_recalc_points()


def trigger_workout_change(instance, new, changes):

    RecalcRequest = apps.get_model('custom_user', 'RecalcRequest')

    if new:
        # newly created workout - add point entries
        Points = apps.get_model('competition', 'Points')
        start_datetime = datetime.datetime.strptime(instance.start_datetime, '%Y-%m-%dT%H:%M:%SZ') if type(instance.start_datetime) is str else instance.start_datetime
        for competition in instance.user.my_competitions.filter(start_date__lte=start_datetime, end_date__gte=start_datetime):
            for goal in competition.activitygoal_set.all():
                if goal.count_steps_as_walks or instance.sport_type != 'Steps':
                    points = _calculate_points_raw(goal=goal, workout=instance, user=instance.user)
                    Points(goal=goal, workout=instance, points_raw=points, points_capped=points).save()
                    RecalcRequest(user=instance.user, goal=goal, start_datetime=start_datetime).save()
    else:
        # updated existing workout
        # check if relevant field was changed
        metric_change_lst = []
        if 'start_datetime' in changes:
            metric_change_lst.extend(['min', 'num', 'kcal', 'km', 'kj'])
        if 'duration' in changes:
            metric_change_lst.extend(['min'])
        if 'kcal' in changes:
            metric_change_lst.extend(['kcal', 'kj'])
        if 'distance' in changes:
            metric_change_lst.extend(['km'])

        recalc_start_datetime = changes.get('start_datetime', [instance.start_datetime])[0]
        for recalc_points, recalc_goal in [(i, i.goal) for i in instance.points_set.all() if i.goal.metric in metric_change_lst]:
            points = _calculate_points_raw(goal=recalc_goal, workout=instance, user=instance.user)
            setattr(recalc_points, 'points_raw', points)
            setattr(recalc_points, 'points_capped', points)
            recalc_points.save()
            RecalcRequest(user=instance.user, goal=recalc_goal, start_datetime=recalc_start_datetime).save()

    print(f"Workout ({instance.pk}) update triggered point cap recalc - {'NEW ENTRY' if new else 'EXISTING CHANGED'}" + ("" if new else f" - {changes}"))

    trigger_recalc_points()


def trigger_goal_change(instance, new, changes):
    RecalcRequest = apps.get_model('custom_user', 'RecalcRequest')
    Points = apps.get_model('competition', 'Points')
    Workout = apps.get_model('workouts', 'Workout')
    if new:
        # newly created goal - add point entries
        workout_lst = Workout.objects.filter(start_datetime__gte=instance.competition.start_date, start_datetime__lte=instance.competition.end_date + datetime.timedelta(days=1), user__in=instance.competition.user.all())
        if instance.count_steps_as_walks is False:
            workout_lst = workout_lst.exclude(sport_type='Steps')
        for workout in workout_lst:
            points = _calculate_points_raw(goal=instance, workout=workout, user=workout.user)
            Points(goal=instance, workout=workout, points_raw=points, points_capped=points).save()
            RecalcRequest(user=workout.user, goal=instance, start_datetime=workout.start_datetime).save()
    else:
        # updated existing workout
        # check if relevant field was changed
        _ = changes.pop('name', None)
        if len(changes) > 0:
            if 'count_steps_as_walks' in changes:
                # add steps
                if changes['count_steps_as_walks'][1]:
                    for workout in Workout.objects.filter(start_datetime__gte=instance.competition.start_date, start_datetime__lte=instance.competition.end_date + datetime.timedelta(days=1), user__in=instance.competition.user.all(), sport_type='Steps'):
                        points = _calculate_points_raw(goal=instance, workout=workout, user=workout.user)
                        Points(goal=instance, workout=workout, points_raw=points, points_capped=points).save()
                # remove steps
                else:
                    for point in instance.points_set.filter(workout__sport_type='Steps'):
                        point.delete()
            for user in instance.competition.user.all():
                RecalcRequest(user=user, goal=instance, start_datetime=instance.competition.start_date).save()

    trigger_recalc_points()


def trigger_competition_change(instance, new, changes):
    Points = apps.get_model('competition', 'Points')
    RecalcRequest = apps.get_model('custom_user', 'RecalcRequest')
    Workout = apps.get_model('workouts', 'Workout')

    # newly created competitions are ignored as only relevant if new goals are created
    # only catching changes of the start_date and end_date below

    if 'start_date' in changes:
        if changes['start_date'][1] < changes['start_date'][0]:
            # add point entries before changes['start_date'][0] till [1]
            for goal in instance.activitygoal_set.all():
                for workout in Workout.objects.filter(start_datetime__gte=changes['start_date'][1], start_datetime__lte=changes['start_date'][0], user__in=instance.user.all()):
                    points = _calculate_points_raw(goal=goal, workout=workout, user=workout.user)
                    Points(goal=goal, workout=workout, points_raw=points, points_capped=points).save()
                    RecalcRequest(user=workout.user, goal=goal, start_datetime=workout.start_datetime).save()
            print(f"Competition ({instance.pk}) start_date was extended from {changes['start_date'][0]} to {changes['start_date'][1]} triggering point cap recalc")
        else:
            # remove point entries before changes['start_date'][1]
            points_to_delete = Points.objects.filter(goal__competition=instance, workout__start_datetime__lt=changes['start_date'][1])
            CustomUser = apps.get_model('custom_user', 'CustomUser')
            ActivityGoal = apps.get_model('competition', 'ActivityGoal')
            for user in [CustomUser.objects.get(pk=i) for i in set(points_to_delete.values_list('workout__user', flat=True))]:
                for goal in [ActivityGoal.objects.get(pk=i) for i in set(points_to_delete.values_list('goal', flat=True))]:
                    RecalcRequest(user=user, goal=goal, start_datetime=changes['start_date'][1]).save()
            points_to_delete.delete()
            print(f"Competition ({instance.pk}) start_date was shortened from {changes['start_date'][0]} to {changes['start_date'][1]} triggering point cap recalc")

        trigger_recalc_points()

    if 'end_date' in changes:
        if changes['end_date'][1] > changes['end_date'][0]:
            # add point entries after changes['end_date'][0] till [1]
            for goal in instance.activitygoal_set.all():
                for workout in Workout.objects.filter(start_datetime__gte=changes['end_date'][0] + datetime.timedelta(days=1), start_datetime__lte=changes['end_date'][1] + datetime.timedelta(days=1), user__in=instance.user.all()):
                    points = _calculate_points_raw(goal=goal, workout=workout, user=workout.user)
                    Points(goal=goal, workout=workout, points_raw=points, points_capped=points).save()
                    RecalcRequest(user=workout.user, goal=goal, start_datetime=workout.start_datetime).save()
            print(f"Competition ({instance.pk}) end_date was extended from {changes['end_date'][0]} to {changes['end_date'][1]} triggering point cap recalc")
        else:
            # remove point entries after changes['end_date'][1]
            Points.objects.filter(goal__competition=instance, workout__start_datetime__gt=changes['end_date'][1]).delete()
            print(f"Competition ({instance.pk}) end_date was shortened from {changes['end_date'][0]} to {changes['end_date'][1]} NOT triggering point cap recalc")

        trigger_recalc_points()


def trigger_user_change(instance, new, changes):
    Points = apps.get_model('competition', 'Points')
    RecalcRequest = apps.get_model('custom_user', 'RecalcRequest')

    # check if user leaves or joins a competition
    if 'my_competitions' in changes:
        # instance user obj / changes = pk_set comp id to add/remove
        if changes['my_competitions'][0] is None:
            # add/join competition
            Workout = apps.get_model('workouts', 'Workout')
            Competition = apps.get_model('competition', 'Competition')
            for competition in Competition.objects.filter(pk__in=changes['my_competitions'][1]):
                workout_lst = Workout.objects.filter(user=instance, start_datetime__gte=competition.start_date, start_datetime__lte=competition.end_date + datetime.timedelta(days=1))
                for goal in competition.activitygoal_set.all():
                    for workout in workout_lst:
                        points = _calculate_points_raw(goal=goal, workout=workout, user=instance)
                        Points(goal=goal, workout=workout, points_raw=points, points_capped=points).save()
                    RecalcRequest(user=instance, goal=goal, start_datetime=competition.start_date).save()
            print(f"User ({instance.pk}) join competitions {changes['my_competitions'][1]} triggering point cap recalc")
        else:
            # remove/leave competition
            Points.objects.filter(goal__competition__in=changes['my_competitions'][0], workout__user=instance).delete()
            print(f"User ({instance.pk}) left competitions {changes['my_competitions'][0]} NOT triggering point cap recalc")

        trigger_recalc_points()

    # check if equalizing / scaling factors were changed
    if 'scaling_distance' in changes or 'scaling_kcal' in changes:
        goal_metrics = (['km'] if 'scaling_distance' in changes else []) + (['kcal', 'kj'] if 'scaling_kcal' in changes else [])
        recalc_points = Points.objects.filter(goal__metric__in=goal_metrics, workout__user=instance)

        for recalc_point in recalc_points:
            points = _calculate_points_raw(goal=recalc_point.goal, workout=recalc_point.workout, user=instance)
            setattr(recalc_point, 'points_raw', points)
            setattr(recalc_point, 'points_capped', points)
            recalc_point.save()
            RecalcRequest(user=instance, goal=recalc_point.goal, start_datetime=recalc_point.workout.start_datetime).save()

        print(f"User ({instance.pk}) scaling factors {goal_metrics} changed triggering point cap recalc")
