from rest_framework import serializers

from .models import Organization, Membership


class OrganizationSerializer(serializers.ModelSerializer):

    my_role = serializers.SerializerMethodField()

    class Meta:
        model = Organization

        fields = [
            "id",
            "name",
            "slug",
            "legal_name",
            "registration_number",
            "country",
            "currency",
            "my_role",
            "created_at"
        ]

        read_only_fields = [
            "id",
            "slug",
            "my_role",
            "created_at"
        ]

    def get_my_role(self, obj):

        request = self.context.get("request")

        if not request or not request.user.is_authenticated:
            return None

        membership = Membership.objects.filter(
            organization=obj,
            user=request.user,
            status=Membership.Status.ACTIVE
        ).only("role").first()

        return membership.role if membership else None


class MembershipSerializer(serializers.ModelSerializer):

    email = serializers.EmailField(
        source="user.email",
        read_only=True
    )

    full_name = serializers.CharField(
        source="user.full_name",
        read_only=True
    )

    class Meta:
        model = Membership

        fields = [
            "id",
            "user",
            "email",
            "full_name",
            "role",
            "status",
            "joined_at"
        ]

        read_only_fields = fields