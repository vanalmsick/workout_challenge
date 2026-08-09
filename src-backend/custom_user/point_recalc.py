import datetime

from django.db.models import Min

from django.core.cache import cache
from workout_challenge.celery import app, single_instance
from django.apps import apps
from django.contrib.auth import get_user_model

# How many Points rows to hold in memory at once while replaying a user/goal through the Scorer.
RECALC_CHUNK_SIZE = 500


def trigger_recalc_points():
    last_recalc = cache.get('last_recalc_points', None)

    if last_recalc is None or last_recalc < datetime.datetime.now() - datetime.timedelta(seconds=30):
        cache.set('last_recalc_points', datetime.datetime.now(), 60 * 10)
        eta = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=10)
        recalc_points.apply_async(eta=eta)
    else:
        print('Recalc points task skipped because it was triggered less than 30 seconds ago')


@app.task(bind=True, time_limit=60 * 30, max_retries=3)  # 30 min time limit
def recalc_points(self):
    with single_instance('recalc_points', timeout=60 * 30) as got_lock:
        if not got_lock:
            print('Recalc points task skipped because it is already running')
            return 'Skipped because it is already running.'

        print('Recalculating points...')

        ActivityGoal = apps.get_model('competition', 'ActivityGoal')
        Points = apps.get_model('competition', 'Points')
        RecalcRequest = apps.get_model('custom_user', 'RecalcRequest')

        all_tasks = RecalcRequest.objects.filter(done=False)
        # Materialise the grouping now: the queryset is re-evaluated in the return statement
        # below, which happens *after* all_tasks.delete() and would otherwise come back empty.
        grouped_tasks = list(all_tasks.values('user', 'goal').annotate(start_datetime=Min('start_datetime')))

        for task_group in grouped_tasks:
            points_lst = (
                Points.objects
                .filter(
                    goal=task_group['goal'],
                    workout__user=task_group['user'],
                    workout__start_datetime__gte=task_group['start_datetime'],
                )
                # select_related pulls the workout in the same query. Without it, Scorer's
                # points.workout access fired one extra query per row and kept every fetched
                # Workout alive on the Points instances for the whole loop.
                .select_related('workout')
                .order_by('workout__start_datetime')
            )

            goal = ActivityGoal.objects.get(pk=task_group['goal'])

            scorer = Scorer()
            scorer.set_goal(goal)

            # .iterator() streams rows in chunks instead of loading (and caching) the entire
            # result set, and bulk_update writes them back in batches rather than one save() -
            # one UPDATE - per row. Memory is now bounded by RECALC_CHUNK_SIZE regardless of how
            # many workouts a competition has accumulated.
            batch = []
            for points in points_lst.iterator(chunk_size=RECALC_CHUNK_SIZE):
                points.points_capped = scorer.calculate_points(points)
                batch.append(points)
                if len(batch) >= RECALC_CHUNK_SIZE:
                    Points.objects.bulk_update(batch, ['points_capped'])
                    batch.clear()
            if batch:
                Points.objects.bulk_update(batch, ['points_capped'])
                batch.clear()

        all_tasks.delete()
        print('All points recalculated.')
        return [{k: str(v) for k, v in i.items()} for i in grouped_tasks]





class Scorer:
    def __init__(self):
        self.memory_today = None
        self.memory_today_points_raw = 0
        self.memory_today_points_capped = 0
        self.memory_this_week = None
        self.memory_week_points_raw = 0
        self.memory_week_points_capped = 0

    def set_goal(self, goal):
        self.goal = goal
        self.floor_workout = 0 if goal.min_per_workout is None else goal.min_per_workout / goal.goal * 100
        self.cap_workout = None if goal.max_per_workout is None else goal.max_per_workout / goal.goal * 100
        self.floor_day = 0 if goal.min_per_day is None else goal.min_per_day / goal.goal * 100
        self.cap_day = None if goal.max_per_day is None else goal.max_per_day / goal.goal * 100
        self.floor_week = 0 if goal.min_per_week is None else goal.min_per_week / goal.goal * 100
        self.cap_week = None if goal.max_per_week is None else goal.max_per_week / goal.goal * 100

    def calculate_points(self, points):
        # potentially reset the memory if new day / week
        if points.workout.start_datetime.date() != self.memory_today:
            self.memory_today = points.workout.start_datetime.date()
            self.memory_today_points_raw = 0
            self.memory_today_points_capped = 0
        if points.workout.start_datetime.isocalendar()[1] != self.memory_this_week:
            self.memory_this_week = points.workout.start_datetime.isocalendar()[1]
            self.memory_week_points_raw = 0
            self.memory_week_points_capped = 0

        earned_points = points.points_raw
        self.memory_today_points_raw += earned_points
        self.memory_week_points_raw += earned_points
        earned_points = points.points_raw

        # workout floor
        earned_points = max(earned_points - self.floor_workout, 0)

        # workout cap
        if self.cap_workout is not None:
            adjusted_cap = self.cap_workout - self.floor_workout
            earned_points = min(earned_points, adjusted_cap)

        # day floor
        earned_points = max(min(earned_points, self.memory_today_points_raw - self.floor_day), 0)

        # day cap
        if self.cap_day is not None:
            max_points_to_earn_today = self.cap_day - self.floor_day
            earned_points = max(min(earned_points, max_points_to_earn_today - self.memory_today_points_capped),0)

        # week floor
        earned_points = max(min(earned_points, self.memory_week_points_raw - self.floor_week), 0)

        # week cap
        if self.cap_week is not None:
            max_points_to_earn_week = self.cap_week - self.floor_week
            earned_points = max(min(earned_points, max_points_to_earn_week - self.memory_week_points_capped),0)


        self.memory_today_points_capped += earned_points
        self.memory_week_points_capped += earned_points
        return earned_points


class DummyObject:
    def __init__(self, **kwargs):
        self.min_per_workout = None
        self.max_per_workout = None
        self.min_per_day = None
        self.max_per_day = None
        self.min_per_week = None
        self.max_per_week = None
        for key, value in kwargs.items():
            setattr(self, key, value)


def test_scorer():

    for goal_kwargs, points, expected_result in (
        ({'goal': 100, 'min_per_workout': 10}, [10], 0),
        ({'goal': 100, 'min_per_workout': 10}, [20], 10),
        ({'goal': 100, 'max_per_workout': 30}, [30], 30),
        ({'goal': 100, 'max_per_workout': 30}, [40], 30),
        ({'goal': 100, 'min_per_workout': 10, 'max_per_workout': 30}, [40], 20),
        ({'goal': 100, 'min_per_day': 10}, [10], 0),
        ({'goal': 100, 'min_per_day': 10}, [20], 10),
        ({'goal': 100, 'min_per_day': 10}, [8, 8], 6),
        ({'goal': 100, 'max_per_day': 30}, [20], 20),
        ({'goal': 100, 'max_per_day': 30}, [20, 20], 30),
        ({'goal': 100, 'min_per_day': 10, 'max_per_day': 30}, [8, 12, 8, 8, 14], 20),
        ({'goal': 100, 'min_per_week': 10}, [10], 0),
        ({'goal': 100, 'min_per_week': 10}, [20], 10),
        ({'goal': 100, 'max_per_week': 30}, [20], 20),
        ({'goal': 100, 'max_per_week': 30}, [20, 20], 30),
        ({'goal': 100, 'min_per_week': 10, 'max_per_week': 30}, [8, 12, 8, 8, 14], 20),
        ({'goal': 100, 'min_per_workout': 10, 'min_per_day': 20}, [5, 20, 5, 20], 15),
        ({'goal': 100, 'min_per_workout': 20, 'min_per_day': 10}, [5, 30, 30], 20),
        ({'goal': 100, 'max_per_workout': 20, 'max_per_day': 30}, [20, 25, 25, 25], 30),
        ({'goal': 100, 'max_per_workout': 30, 'max_per_day': 20}, [20, 25, 25, 25], 20),
        ({'goal': 100, 'min_per_workout': 10, 'max_per_day': 15}, [5, 5, 5, 5], 0),
        ({'goal': 100, 'min_per_workout': 10, 'max_per_day': 30}, [15, 35, 5, 15], 30),
    ):
        workout = DummyObject(start_datetime=datetime.datetime.fromisoformat('2023-01-01T00:00:00'))
        goal = DummyObject(**goal_kwargs)
        scorer = Scorer()
        scorer.set_goal(goal)

        earned_points = 0
        for point in points:
            point_obj = DummyObject(points_raw=point, workout = workout)
            earned_points += scorer.calculate_points(point_obj)

        assert earned_points == expected_result, f'Expected {expected_result}, got {earned_points} for goal {goal_kwargs}'





if __name__ == '__main__':
    test_scorer()

