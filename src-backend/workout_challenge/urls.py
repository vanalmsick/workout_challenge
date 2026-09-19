"""
URL configuration for workout_challenge project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenBlacklistView
from competition.views import CompetitionViewSet, TeamViewSet, ActivityGoalViewSet, PointsViewSet, CompetitionStatsQueryView, FeedQueryView, JoinCompetitionView, JoinTeamView, CeleryQueryView
from workouts.views import WorkoutViewSet
from custom_user.views import CustomUserViewSet, LinkStravaView, UnlinkStravaView, SyncStravaView, PasswordResetView, PasswordResetConfirmView, TokenRefreshViewWithLastLogin, TokenObtainPairViewWithReactivate

router = DefaultRouter()
router.register(r'competition', CompetitionViewSet, basename='competition')
router.register(r'team', TeamViewSet, basename='teams')
router.register(r'goal', ActivityGoalViewSet, basename='goal')
router.register(r'workout', WorkoutViewSet, basename='workout')
router.register(r'point', PointsViewSet, basename='points')
router.register(r'user', CustomUserViewSet, basename='cutomuser')

urlpatterns = [
    path('api/', include([
        path('', include(router.urls)),
        path('stats/<int:competition>/', CompetitionStatsQueryView.as_view(), name='competition-stats'),
        path('feed/<int:competition>/', FeedQueryView.as_view(), name='competition-feed'),
        path('join/competition/<str:join_code>/', JoinCompetitionView.as_view(), name='join-competition'),
        path('join/team/', JoinTeamView.as_view(), name='join-team'),
        path('strava/link/<str:code>/', LinkStravaView.as_view(), name='strava-link'),
        path('strava/unlink/', UnlinkStravaView.as_view(), name='strava-unlink'),
        path('strava/sync/', SyncStravaView.as_view(), name='strava-sync'),
        path('celery/tasks/', CeleryQueryView.as_view(), name='celery-task-list'),
        path('celery/tasks/<str:task_id>/', CeleryQueryView.as_view(), name='celery-task-status'),
        path('celery/', CeleryQueryView.as_view(), name='celery-task-run'),
        path('token/', TokenObtainPairViewWithReactivate.as_view(), name='token-initial'),
        path('token/refresh/', TokenRefreshViewWithLastLogin.as_view(), name='token-refresh'),
        path('token/blacklist/', TokenBlacklistView.as_view(), name='token-blacklist'),  # logout
        path('password-reset/request/', PasswordResetView.as_view(), name='password-reset'),
        path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    ])),
    path('admin/', admin.site.urls),
]


admin.site.site_header = 'Backend Admin Panel'
admin.site.site_title = 'Workout Challenge Backend'
admin.site.index_title = 'Welcome to the Workout Challenge Backend'
