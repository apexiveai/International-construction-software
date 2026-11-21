
from django.contrib import admin

from .models import (
    BIMModel,
    BIMModelVersion,
    BIMLevel,
    BIMGrid,
    BIMElement,
    BIMElementRevision,
)


class BIMModelVersionInline(admin.TabularInline):
    model = BIMModelVersion
    extra = 0
    readonly_fields = ("created_at",)


@admin.register(BIMModel)
class BIMModelAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "project",
        "discipline",
        "status",
        "created_at",
    )
    list_filter = ("discipline", "status")
    search_fields = ("name", "project__name")
    inlines = [BIMModelVersionInline]


@admin.register(BIMModelVersion)
class BIMModelVersionAdmin(admin.ModelAdmin):
    list_display = (
        "model",
        "version_number",
        "file_format",
        "status",
        "created_at",
    )
    list_filter = ("status", "file_format")
    search_fields = ("model__name", "checksum")


@admin.register(BIMLevel)
class BIMLevelAdmin(admin.ModelAdmin):
    list_display = ("name", "model", "elevation", "sort_order")
    search_fields = ("name", "model__name")


@admin.register(BIMGrid)
class BIMGridAdmin(admin.ModelAdmin):
    list_display = ("name", "model", "axis", "coordinate")
    list_filter = ("axis",)


@admin.register(BIMElement)
class BIMElementAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "model",
        "category",
        "level",
        "status",
    )
    list_filter = ("category", "status", "discipline")
    search_fields = (
        "name",
        "external_id",
        "ifc_guid",
        "model__name",
    )


@admin.register(BIMElementRevision)
class BIMElementRevisionAdmin(admin.ModelAdmin):
    list_display = (
        "element",
        "revision_number",
        "changed_by",
        "created_at",
    )
    readonly_fields = ("created_at",)
