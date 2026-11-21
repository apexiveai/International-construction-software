from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied

from apps.organizations.models import Membership
from .models import Project
from .serializers import ProjectSerializer


MANAGER_ROLES = [
    Membership.Role.OWNER,
    Membership.Role.ADMIN,
    Membership.Role.PROJECT_MANAGER
]

ADMIN_ROLES = [
    Membership.Role.OWNER,
    Membership.Role.ADMIN
]


class ProjectListCreateAPIView(generics.ListCreateAPIView):

    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    filterset_fields = [
        "organization",
        "status",
        "project_type"
    ]

    search_fields = [
        "name",
        "code",
        "description",
        "location"
    ]

    ordering_fields = [
        "created_at",
        "name",
        "start_date",
        "target_end_date"
    ]

    def get_queryset(self):

        return Project.objects.filter(
            organization__memberships__user=self.request.user,
            organization__memberships__status=Membership.Status.ACTIVE
        ).distinct().select_related(
            "organization",
            "created_by"
        )

    def perform_create(self, serializer):

        organization = serializer.validated_data["organization"]

        membership = Membership.objects.filter(
            organization=organization,
            user=self.request.user,
            status=Membership.Status.ACTIVE
        ).first()

        if not membership or membership.role not in MANAGER_ROLES:
            raise PermissionDenied(
                "You cannot create projects in this organization."
            )

        serializer.save(created_by=self.request.user)


class ProjectDetailAPIView(generics.RetrieveUpdateDestroyAPIView):

    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = "id"

    def get_queryset(self):

        return Project.objects.filter(
            organization__memberships__user=self.request.user,
            organization__memberships__status=Membership.Status.ACTIVE
        ).distinct()

    def perform_update(self, serializer):

        project = self.get_object()

        membership = Membership.objects.filter(
            organization=project.organization,
            user=self.request.user,
            status=Membership.Status.ACTIVE
        ).first()

        if not membership or membership.role not in MANAGER_ROLES:
            raise PermissionDenied(
                "You cannot update this project."
            )

        serializer.save()

    def perform_destroy(self, instance):

        membership = Membership.objects.filter(
            organization=instance.organization,
            user=self.request.user,
            status=Membership.Status.ACTIVE
        ).first()

        if not membership or membership.role not in ADMIN_ROLES:
            raise PermissionDenied(
                "Only owners or admins can delete projects."
            )

        instance.delete()