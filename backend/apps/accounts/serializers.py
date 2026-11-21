from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers

from .models import User
from apps.organizations.models import Organization, Membership


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        trim_whitespace=False
    )
    full_name = serializers.CharField(max_length=180)
    organization_name = serializers.CharField(max_length=180)

    def validate_email(self, value):
        value = value.strip().lower()

        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "This email is already registered."
            )

        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    @transaction.atomic
    def create(self, validated_data):
        full_name = validated_data["full_name"].strip()

        user = User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            full_name=full_name,
            first_name=full_name.split(" ")[0]
        )

        organization = Organization.objects.create(
            name=validated_data["organization_name"].strip(),
            created_by=user
        )

        Membership.objects.create(
            organization=organization,
            user=user,
            role=Membership.Role.OWNER,
            status=Membership.Status.ACTIVE
        )

        return user


class UserSerializer(serializers.ModelSerializer):

    class Meta:
        model = User

        fields = [
            "id",
            "email",
            "full_name",
            "phone_number",
            "job_title",
            "date_joined"
        ]

        read_only_fields = [
            "id",
            "email",
            "date_joined"
        ]