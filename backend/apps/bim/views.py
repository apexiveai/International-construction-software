
from django.db.models import Max
from rest_framework import generics
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated

from apps.organizations.models import Membership
from .models import (
    BIMModel,
    BIMModelVersion,
    BIMLevel,
    BIMGrid,
    BIMElement,
)
from .serializers import (
    BIMModelSerializer,
    BIMModelVersionSerializer,
    BIMLevelSerializer,
    BIMGridSerializer,
    BIMElementSerializer,
)


WRITE_ROLES = [
    "OWNER",
    "ADMIN",
    "PROJECT_MANAGER",
    "ARCHITECT",
    "STRUCTURAL_ENGINEER",
    "MEP_ENGINEER",
]


def active_organization_ids(user):
    return Membership.objects.filter(
        user=user,
        status="ACTIVE",
    ).values_list("organization_id", flat=True)


def require_project_write(user, project):
    allowed = Membership.objects.filter(
        user=user,
        organization_id=project.organization_id,
        status="ACTIVE",
        role__in=WRITE_ROLES,
    ).exists()

    if not allowed:
        raise PermissionDenied(
            "You do not have permission to modify this project."
        )


class BIMModelListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = BIMModelSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = BIMModel.objects.filter(
            project__organization_id__in=active_organization_ids(
                self.request.user
            )
        ).select_related("project", "created_by")

        project_id = self.request.query_params.get("project")
        discipline = self.request.query_params.get("discipline")

        if project_id:
            queryset = queryset.filter(project_id=project_id)

        if discipline:
            queryset = queryset.filter(discipline=discipline)

        return queryset

    def perform_create(self, serializer):
        project = serializer.validated_data["project"]
        require_project_write(self.request.user, project)
        serializer.save(created_by=self.request.user)


class BIMModelDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = BIMModelSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "id"

    def get_queryset(self):
        return BIMModel.objects.filter(
            project__organization_id__in=active_organization_ids(
                self.request.user
            )
        ).select_related("project")

    def perform_update(self, serializer):
        require_project_write(
            self.request.user,
            serializer.instance.project,
        )
        serializer.save()

    def perform_destroy(self, instance):
        require_project_write(self.request.user, instance.project)
        instance.delete()


class BIMLevelListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = BIMLevelSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return BIMLevel.objects.filter(
            model__project__organization_id__in=active_organization_ids(
                self.request.user
            )
        ).select_related("model")

    def perform_create(self, serializer):
        model = serializer.validated_data["model"]
        require_project_write(self.request.user, model.project)
        serializer.save()


class BIMGridListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = BIMGridSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return BIMGrid.objects.filter(
            model__project__organization_id__in=active_organization_ids(
                self.request.user
            )
        ).select_related("model")

    def perform_create(self, serializer):
        model = serializer.validated_data["model"]
        require_project_write(self.request.user, model.project)
        serializer.save()


class BIMElementListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = BIMElementSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = BIMElement.objects.filter(
            model__project__organization_id__in=active_organization_ids(
                self.request.user
            )
        ).select_related("model", "level", "created_by")

        model_id = self.request.query_params.get("model")
        category = self.request.query_params.get("category")
        level_id = self.request.query_params.get("level")

        if model_id:
            queryset = queryset.filter(model_id=model_id)

        if category:
            queryset = queryset.filter(category=category)

        if level_id:
            queryset = queryset.filter(level_id=level_id)

        return queryset

    def perform_create(self, serializer):
        model = serializer.validated_data["model"]
        require_project_write(self.request.user, model.project)
        serializer.save(created_by=self.request.user)


class BIMModelVersionListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = BIMModelVersionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = BIMModelVersion.objects.filter(
            model__project__organization_id__in=active_organization_ids(
                self.request.user
            )
        ).select_related("model", "uploaded_by")

        model_id = self.request.query_params.get("model")
        if model_id:
            queryset = queryset.filter(model_id=model_id)

        return queryset

    def perform_create(self, serializer):
        model = serializer.validated_data["model"]
        require_project_write(self.request.user, model.project)

        latest = model.versions.aggregate(
            latest=Max("version_number")
        )["latest"] or 0

        serializer.save(
            uploaded_by=self.request.user,
            version_number=latest + 1,
        )
