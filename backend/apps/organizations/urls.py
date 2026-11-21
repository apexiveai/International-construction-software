from django.urls import path

from .views import (
    OrganizationListAPIView,
    OrganizationMembersAPIView
)

urlpatterns = [
    path(
        "",
        OrganizationListAPIView.as_view(),
        name="organization-list"
    ),

    path(
        "<uuid:organization_id>/members/",
        OrganizationMembersAPIView.as_view(),
        name="organization-members"
    )
]