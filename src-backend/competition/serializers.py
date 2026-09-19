from rest_framework import serializers
from custom_user.models import CustomUser
from .models import Competition, ActivityGoal, Team, Points


class CompetitionSerializer(serializers.ModelSerializer):
    owner = serializers.PrimaryKeyRelatedField(
        queryset=CustomUser.objects.all(),
        required=False
    )
    user_info = serializers.SerializerMethodField()

    class Meta:
        model = Competition
        fields = ['id', 'owner', 'user', 'user_info', 'name', 'start_date', 'start_date_fmt', 'start_date_epoch', 'end_date', 'end_date_fmt', 'end_date_epoch', 'has_teams', 'organizer_assigns_teams', 'join_code']
        read_only_fields = ['join_code', 'user', 'user_info']

    def get_user_info(self, obj):
        # Assuming `obj.user` is a ManyToMany or related manager
        users = obj.user.all().order_by('username') if hasattr(obj.user, 'all') else [obj.user]
        return [{'id': u.id, 'username': u.username} for u in users]


class TeamSerializer(serializers.ModelSerializer):
    user_info = serializers.SerializerMethodField()
    my = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = ['id', 'name', 'competition', 'user', 'user_info', 'my']
        read_only_fields = ['user', 'user_info', 'my']

    def validate_competition(self, value):
        # A goal/team must stay in its competition - the owner check only covers the competition it is in now
        if self.instance is not None and value != self.instance.competition:
            raise serializers.ValidationError("The competition cannot be changed.")
        return value

    def get_user_info(self, obj):
        # Assuming `obj.user` is a ManyToMany or related manager
        users = obj.user.all().order_by('username') if hasattr(obj.user, 'all') else [obj.user]
        return [{'id': u.id, 'username': u.username} for u in users]

    def get_my(self, obj):
        # if it is the user's team
        request = self.context.get('request')
        if request and hasattr(request, "user"):
            return obj.user.filter(id=request.user.id).exists()
        return False


class ActivityGoalSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityGoal
        fields = '__all__'
        read_only_fields = []

    def validate_competition(self, value):
        # A goal/team must stay in its competition - the owner check only covers the competition it is in now
        if self.instance is not None and value != self.instance.competition:
            raise serializers.ValidationError("The competition cannot be changed.")
        return value


class PointsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Points
        fields = ['id', 'goal', 'award', 'workout', 'points_raw', 'points_capped']
        read_only_fields = []
