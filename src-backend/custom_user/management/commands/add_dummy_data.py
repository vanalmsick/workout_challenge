from django.core.management import BaseCommand
import datetime, random
from datetime import timedelta

from competition.models import Competition, ActivityGoal, Team, Award, Points
from workouts.models import Workout
from custom_user.models import CustomUser


class Command(BaseCommand):
    """Add additional test data"""

    # Show this when the user types help
    help = "Adds test data"

    def handle(self, *args, **options):
        """Actual Commandline executed function when manage.py command is called"""
        test_users = [
            {
                "email": "user1@admin.local",
                "password": "password",
                "first_name": "Charlotte",
                "last_name": "Doe",
                "is_superuser": True,
                "is_staff": True,
                "strava_athlete_id": 123456789,
            },
            {
                "email": "user2@admin.local",
                "password": "password",
                "first_name": "Tom",
                "last_name": "Smith-Bloggs",
                "is_superuser": True,
                "is_staff": True,
            },
            {
                "email": "user3@admin.local",
                "password": "password",
                "first_name": "User",
                "last_name": "von der Leyen",
                "is_superuser": False,
                "is_staff": False,
            },
        ]

        user_obj_dict = {}
        for user_i in test_users:
            user_obj = CustomUser.objects.create_user(**user_i)
            user_obj.set_password(user_i["password"])
            user_obj.save()

            user_obj_dict[user_i["email"]] = user_obj



        # Competition windows are relative to today. They used to be hardcoded to 2025 while the
        # dummy workouts below are always generated for "the last 6 months", so once the calendar
        # moved past 2025 the two ranges stopped overlapping entirely: every workout fell outside
        # every competition, no Points rows were created, and the seeded dev environment came up
        # with an empty leaderboard.
        today_date = datetime.date.today()

        test_competitions = [
            {
                "owner": CustomUser.objects.get(email="user1@admin.local"),
                "name": "WHO Competition",
                "join_code": "WHOComp",
                # started part-way through the generated workout history, still running
                "start_date": today_date - timedelta(days=30 * 4),
                "end_date": today_date + timedelta(days=30 * 8),
                "has_teams": True,
                "teams": [
                    {
                        "name": "Team 1",
                        "members": [
                            "user1@admin.local",
                            "user2@admin.local",
                        ]
                    }
                ],
                "goals": [
                    {
                        "name": "Move",
                        "metric": "kcal",
                        "period": "week",
                        "goal": 600,
                        "max_per_day": 1_200,
                        "max_per_week": 6_000,  # 5x the daily limit
                    },
                    {
                        "name": "Exercise",
                        "metric": "min",
                        "period": "day",
                        "goal": 30,
                        "max_per_day": 60,
                        "max_per_week": 300,  # 5x the daily limit
                    },
                ],
                "awards": [
                    {
                        "name": "10 Workouts (Bronze)",
                        "sport": "GROUP_ANY",
                        "threshold": 10,
                        "period": "competition",  # "end" was not one of POINT_REF_PERIODS
                        "reward_points": 250,
                    },
                    {
                        "name": "25 Workouts (Silver)",
                        "sport": "GROUP_ANY",
                        "threshold": 25,
                        "period": "competition",  # "end" was not one of POINT_REF_PERIODS
                        "reward_points": 500,
                    },
                    {
                        "name": "50 Workouts (Gold)",
                        "sport": "GROUP_ANY",
                        "threshold": 25,
                        "period": "competition",  # "end" was not one of POINT_REF_PERIODS
                        "reward_points": 1_000,
                    },
                ]
            },
            {
                "owner": CustomUser.objects.get(email="user2@admin.local"),
                "name": "100k 1k Competition",
                "join_code": "100k1k",
                # spans the whole generated workout history
                "start_date": today_date - timedelta(days=30 * 7),
                "end_date": today_date + timedelta(days=30 * 5),
                "teams": [
                    {
                        "name": "Team 1",
                        "members": [
                            "user3@admin.local",
                            "user2@admin.local",
                        ]
                    }
                ],
                "goals": [
                    {
                        "name": "Distance",
                        "metric": "km",
                        "period": "competition",
                        "goal": 1_000,
                        "min_per_workout": 5,
                    },
                    {
                        "name": "Effort",
                        "metric": "kj",
                        "period": "month",
                        "goal": 1_000,
                    },
                    {
                        "name": "Workouts",
                        "metric": "num",
                        "period": "week",
                        "goal": 3,
                        "max_per_day": 2,
                        "max_per_week": 6,
                    },
                ]
            }
        ]


        for competitions_i in test_competitions:
            goals = competitions_i.pop("goals", [])
            awards = competitions_i.pop("awards", [])
            teams = competitions_i.pop("teams", [])
            competitions_obj = Competition(**competitions_i)
            competitions_obj.save()

            for goal_i in goals:
                goal_obj = ActivityGoal(competition=competitions_obj, **goal_i)
                goal_obj.save()

            for award_i in awards:
                award_obj = Award(competition=competitions_obj, **award_i)
                award_obj.save()

            for team_i in teams:
                team_i_name = team_i.pop("name")
                team_i_members = team_i.pop("members", [])
                team_obj = Team(competition=competitions_obj, name=team_i_name)
                team_obj.save()
                for user_i in team_i_members:
                    user_i_obj = CustomUser.objects.get(email=user_i)
                    user_i_obj.my_teams.add(team_obj)
                    user_i_obj.my_competitions.add(competitions_obj)
                    user_i_obj.save()


        test_workouts = []
        today = datetime.datetime.now()
        curr_datetime = today - datetime.timedelta(days=30*6)  # 6 months ago
        while curr_datetime < today:
            today_entries = random.randint(0, len(test_users))
            user_entries = random.sample(test_users, k=today_entries)
            for user_i in user_entries:
                duration_i = random.randint(15, 75)
                sport_i = random.sample(['Run', 'Tennis', 'WeightTraining', 'Workout'], k=1)[0]

                workout_i = {
                        'user': user_i['email'],
                        'sport_type': sport_i,
                        'start_datetime': curr_datetime,
                        'duration': timedelta(minutes=duration_i),
                        'intensity_category': random.sample([1, 2, 3, 4], k=1)[0],
                        'kcal': random.uniform(0.6, 1.3) * 10 * duration_i,
                        'distance': duration_i / random.uniform(5, 8) if sport_i == 'Run' else None,
                        'strava_id': random.randint(0, 999999999) if random.sample([True, False], k=1)[0] else None,
                }

                #points_i = []
                #user_i_obj = CustomUser.objects.get(email=user_i['email'])
                #for competitions_i in user_i_obj.my_competitions.all():
                #    if (curr_datetime.date() >= competitions_i.start_date) & (curr_datetime.date() <= competitions_i.end_date):
                #        for goal_i in competitions_i.activitygoal_set.all():
                #            points = duration_i * random.uniform(0.75, 2.5) / 25
                #            points_i.append({
                #                "goal": goal_i,
                #                "points_raw": points,
                #                "points_capped": points,
                #            })

                test_workouts.append({**workout_i}) #, 'points': points_i})
                curr_datetime += timedelta(minutes=random.uniform(2, 4) * 60 * 24)


        for workout_i in test_workouts:
            #points = workout_i.pop("points", [])
            user_email = workout_i.pop("user", None)
            user = CustomUser.objects.get(email=user_email)
            workout_obj = Workout(user=user, **workout_i)
            workout_obj.save()

            #for point_i in points:
            #    point_obj = Points(workout=workout_obj, **point_i)
            #    point_obj.save()


