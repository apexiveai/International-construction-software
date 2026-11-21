
import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q


def bim_file_upload_path(instance, filename):
    project_id = instance.model.project_id
    model_id = instance.model_id
    return f"bim/{project_id}/{model_id}/{filename}"


class BIMModel(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        ACTIVE = "ACTIVE", "Active"
        ARCHIVED = "ARCHIVED", "Archived"

    class Discipline(models.TextChoices):
        ARCHITECTURE = "ARCHITECTURE", "Architecture"
        STRUCTURE = "STRUCTURE", "Structure"
        MEP = "MEP", "MEP"
        CIVIL = "CIVIL", "Civil"
        LANDSCAPE = "LANDSCAPE", "Landscape"
        COORDINATION = "COORDINATION", "Coordination"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="bim_models",
    )

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    discipline = models.CharField(
        max_length=30,
        choices=Discipline.choices,
        default=Discipline.ARCHITECTURE,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )

    source_format = models.CharField(
        max_length=20,
        blank=True,
        help_text="IFC, RVT, DWG, DXF, GLB, etc.",
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_bim_models",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["project", "status"]),
            models.Index(fields=["project", "discipline"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.discipline})"


class BIMModelVersion(models.Model):
    class Status(models.TextChoices):
        PROCESSING = "PROCESSING", "Processing"
        READY = "READY", "Ready"
        FAILED = "FAILED", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    model = models.ForeignKey(
        BIMModel,
        on_delete=models.CASCADE,
        related_name="versions",
    )

    version_number = models.PositiveIntegerField()
    name = models.CharField(max_length=150, blank=True)
    description = models.TextField(blank=True)

    source_file = models.FileField(
        upload_to=bim_file_upload_path,
        blank=True,
        null=True,
    )

    geometry_file = models.FileField(
        upload_to=bim_file_upload_path,
        blank=True,
        null=True,
    )

    file_format = models.CharField(max_length=20, blank=True)
    file_size = models.PositiveBigIntegerField(default=0)
    checksum = models.CharField(max_length=128, blank=True)

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PROCESSING,
    )

    metadata = models.JSONField(default=dict, blank=True)

    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="uploaded_bim_versions",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-version_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["model", "version_number"],
                name="unique_bim_model_version",
            )
        ]

    def __str__(self):
        return f"{self.model.name} - v{self.version_number}"


class BIMLevel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    model = models.ForeignKey(
        BIMModel,
        on_delete=models.CASCADE,
        related_name="levels",
    )

    name = models.CharField(max_length=100)
    elevation = models.FloatField(default=0)
    height = models.FloatField(null=True, blank=True)
    sort_order = models.IntegerField(default=0)

    properties = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "elevation"]
        constraints = [
            models.UniqueConstraint(
                fields=["model", "name"],
                name="unique_bim_level_name",
            )
        ]

    def __str__(self):
        return f"{self.model.name} / {self.name}"


class BIMGrid(models.Model):
    class Axis(models.TextChoices):
        X = "X", "X Axis"
        Y = "Y", "Y Axis"
        RADIAL = "RADIAL", "Radial"
        OTHER = "OTHER", "Other"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    model = models.ForeignKey(
        BIMModel,
        on_delete=models.CASCADE,
        related_name="grids",
    )

    name = models.CharField(max_length=50)
    axis = models.CharField(max_length=10, choices=Axis.choices)

    coordinate = models.FloatField(default=0)
    start_point = models.JSONField(default=dict, blank=True)
    end_point = models.JSONField(default=dict, blank=True)

    properties = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["axis", "coordinate"]
        constraints = [
            models.UniqueConstraint(
                fields=["model", "axis", "name"],
                name="unique_bim_grid_name",
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.axis})"


class BIMElement(models.Model):
    class Status(models.TextChoices):
        EXISTING = "EXISTING", "Existing"
        NEW = "NEW", "New"
        DEMOLISHED = "DEMOLISHED", "Demolished"
        TEMPORARY = "TEMPORARY", "Temporary"

    class Category(models.TextChoices):
        WALL = "WALL", "Wall"
        SLAB = "SLAB", "Slab"
        BEAM = "BEAM", "Beam"
        COLUMN = "COLUMN", "Column"
        FOUNDATION = "FOUNDATION", "Foundation"
        DOOR = "DOOR", "Door"
        WINDOW = "WINDOW", "Window"
        ROOF = "ROOF", "Roof"
        STAIR = "STAIR", "Stair"
        RAILING = "RAILING", "Railing"
        PIPE = "PIPE", "Pipe"
        DUCT = "DUCT", "Duct"
        CABLE = "CABLE", "Cable"
        EQUIPMENT = "EQUIPMENT", "Equipment"
        FURNITURE = "FURNITURE", "Furniture"
        OTHER = "OTHER", "Other"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    model = models.ForeignKey(
        BIMModel,
        on_delete=models.CASCADE,
        related_name="elements",
    )

    level = models.ForeignKey(
        BIMLevel,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="elements",
    )

    external_id = models.CharField(max_length=150, blank=True)
    ifc_guid = models.CharField(max_length=64, blank=True)

    name = models.CharField(max_length=255)
    category = models.CharField(
        max_length=30,
        choices=Category.choices,
        default=Category.OTHER,
    )

    discipline = models.CharField(max_length=30, blank=True)

    family = models.CharField(max_length=150, blank=True)
    type_name = models.CharField(max_length=150, blank=True)

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.NEW,
    )

    # Lightweight spatial metadata, not a full 3D mesh.
    position = models.JSONField(default=dict, blank=True)
    rotation = models.JSONField(default=dict, blank=True)
    dimensions = models.JSONField(default=dict, blank=True)
    geometry_reference = models.CharField(max_length=500, blank=True)

    # Custom BIM parameters and property sets.
    properties = models.JSONField(default=dict, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_bim_elements",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["category", "name"]
        indexes = [
            models.Index(fields=["model", "category"]),
            models.Index(fields=["model", "level"]),
            models.Index(fields=["model", "status"]),
            models.Index(fields=["ifc_guid"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["model", "external_id"],
                condition=~Q(external_id=""),
                name="unique_bim_element_external_id",
            ),
            models.UniqueConstraint(
                fields=["model", "ifc_guid"],
                condition=~Q(ifc_guid=""),
                name="unique_bim_element_ifc_guid",
            ),
        ]

    def __str__(self):
        return f"{self.name} [{self.category}]"


class BIMElementRevision(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    element = models.ForeignKey(
        BIMElement,
        on_delete=models.CASCADE,
        related_name="revisions",
    )

    revision_number = models.PositiveIntegerField()
    snapshot = models.JSONField(default=dict)

    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="bim_element_revisions",
    )

    change_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-revision_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["element", "revision_number"],
                name="unique_bim_element_revision",
            )
        ]
