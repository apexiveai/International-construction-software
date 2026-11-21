import uuid

from django.conf import settings
from django.db import models

from apps.organizations.models import Organization


class Project(models.Model):

    class Status(models.TextChoices):

        PLANNING = "PLANNING", "Planning"
        ACTIVE = "ACTIVE", "Active"
        ON_HOLD = "ON_HOLD", "On Hold"
        COMPLETED = "COMPLETED", "Completed"
        ARCHIVED = "ARCHIVED", "Archived"

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="projects"
    )

    code = models.CharField(max_length=40)

    name = models.CharField(max_length=180)

    description = models.TextField(blank=True)

    project_type = models.CharField(
        max_length=60,
        default="BUILDING"
    )

    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PLANNING
    )

    location = models.CharField(
        max_length=255,
        blank=True
    )

    start_date = models.DateField(
        null=True,
        blank=True
    )

    target_end_date = models.DateField(
        null=True,
        blank=True
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_projects"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:

        ordering = ["-created_at"]

        constraints = [
            models.UniqueConstraint(
                fields=["organization", "code"],
                name="unique_project_code_per_org"
            )
        ]

    def __str__(self):

        return f"{self.code} - {self.name}"


class ProjectMember(models.Model):

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="members"
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="project_memberships"
    )

    role = models.CharField(
        max_length=40,
        default="MEMBER"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:

        constraints = [
            models.UniqueConstraint(
                fields=["project", "user"],
                name="unique_project_member"
            )
        ]