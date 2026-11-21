from rest_framework import serializers

from .models import Project
from apps.organizations.models import Membership


class ProjectSerializer(serializers.ModelSerializer):

    class Meta:
        model = Project

        fields = [
            "id",
            "organization",
            "code",
            "name",
            "description",
            "project_type",
            "status",
            "location",
            "start_date",
            "target_end_date",
            "created_by",
            "created_at",
            "updated_at"
        ]

        read_only_fields = [
            "id",
            "created_by",
            "created_at",
            "updated_at"
        ]

    def validate_organization(self, organization):

        is_member = Membership.objects.filter(
            organization=organization,
            user=self.context["request"].user,
            status=Membership.Status.ACTIVE
        ).exists()

        if not is_member:
            raise serializers.ValidationError(
                "You are not an active member of this organization."
            )

        return organization