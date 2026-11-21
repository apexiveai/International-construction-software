
from django.urls import path

from .views import (
    BIMModelListCreateAPIView,
    BIMModelDetailAPIView,
    BIMModelVersionListCreateAPIView,
    BIMLevelListCreateAPIView,
    BIMGridListCreateAPIView,
    BIMElementListCreateAPIView,
)

urlpatterns = [
    path("models/", BIMModelListCreateAPIView.as_view(), name="bim-model-list"),
    path(
        "models/<uuid:id>/",
        BIMModelDetailAPIView.as_view(),
        name="bim-model-detail",
    ),
    path(
        "versions/",
        BIMModelVersionListCreateAPIView.as_view(),
        name="bim-version-list",
    ),
    path("levels/", BIMLevelListCreateAPIView.as_view(), name="bim-level-list"),
    path("grids/", BIMGridListCreateAPIView.as_view(), name="bim-grid-list"),
    path(
        "elements/",
        BIMElementListCreateAPIView.as_view(),
        name="bim-element-list",
    ),
]
