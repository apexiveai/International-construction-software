
from rest_framework import serializers

from .models import (
    BIMModel,
    BIMModelVersion,
    BIMLevel,
    BIMGrid,
    BIMElement,
    BIMElementRevision,
)


class BIMModelSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(
        source="project.name",
        read_only=True,
    )

    class Meta:
        model = BIMModel
        fields = "__all__"
        read_only_fields = (
            "id",
            "uploaded_by",
            "created_at",
            "file_size",
            "version_number",
        )


class BIMModelVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = BIMModelVersion
        fields = "__all__"
        read_only_fields = (
            "id",
            "uploaded_by",
            "created_at",
            "file_size",
        )


class BIMLevelSerializer(serializers.ModelSerializer):
    class Meta:
        model = BIMLevel
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class BIMGridSerializer(serializers.ModelSerializer):
    class Meta:
        model = BIMGrid
        fields = "__all__"
        read_only_fields = ("id",)


class BIMElementSerializer(serializers.ModelSerializer):
    level_name = serializers.CharField(
        source="level.name",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = BIMElement
        fields = "__all__"
        read_only_fields = (
            "id",
            "created_by",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        model = attrs.get("model", getattr(self.instance, "model", None))
        level = attrs.get("level", getattr(self.instance, "level", None))

        if level and model and level.model_id != model.id:
            raise serializers.ValidationError({
                "level": "The selected level belongs to another BIM model."
            })

        return attrs


class BIMElementRevisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = BIMElementRevision
        fields = "__all__"
        read_only_fields = ("id", "changed_by", "created_at")
