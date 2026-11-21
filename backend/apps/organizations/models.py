import uuid

from django.conf import settings
from django.db import models
from django.utils.text import slugify


class Organization(models.Model):

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    name = models.CharField(max_length=180)

    slug = models.SlugField(
        max_length=200,
        unique=True,
        blank=True
    )

    legal_name = models.CharField(
        max_length=220,
        blank=True
    )

    registration_number = models.CharField(
        max_length=100,
        blank=True
    )

    country = models.CharField(
        max_length=2,
        default="MM"
    )

    currency = models.CharField(
        max_length=3,
        default="MMK"
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_organizations"
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):

        if not self.slug:

            base = slugify(self.name) or "organization"

            candidate = base
            counter = 1

            while Organization.objects.filter(
                slug=candidate
            ).exclude(pk=self.pk).exists():

                counter += 1
                candidate = f"{base}-{counter}"

            self.slug = candidate

        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Membership(models.Model):

    class Role(models.TextChoices):

        OWNER = "OWNER", "Owner"
        ADMIN = "ADMIN", "Administrator"

        PROJECT_MANAGER = "PROJECT_MANAGER", "Project Manager"

        ARCHITECT = "ARCHITECT", "Architect"

        STRUCTURAL_ENGINEER = (
            "STRUCTURAL_ENGINEER",
            "Structural Engineer"
        )

        MEP_ENGINEER = "MEP_ENGINEER", "MEP Engineer"

        QUANTITY_SURVEYOR = (
            "QUANTITY_SURVEYOR",
            "Quantity Surveyor"
        )

        ACCOUNTANT = "ACCOUNTANT", "Accountant"

        PROCUREMENT = "PROCUREMENT", "Procurement"

        SITE_ENGINEER = "SITE_ENGINEER", "Site Engineer"

        VIEWER = "VIEWER", "Viewer"

    class Status(models.TextChoices):

        INVITED = "INVITED", "Invited"
        ACTIVE = "ACTIVE", "Active"
        SUSPENDED = "SUSPENDED", "Suspended"

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="memberships"
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="memberships"
    )

    role = models.CharField(
        max_length=32,
        choices=Role.choices,
        default=Role.VIEWER
    )

    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.INVITED
    )

    joined_at = models.DateTimeField(
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:

        constraints = [
            models.UniqueConstraint(
                fields=["organization", "user"],
                name="unique_org_membership"
            )
        ]

    def __str__(self):

        return f"{self.user} - {self.organization} ({self.role})"