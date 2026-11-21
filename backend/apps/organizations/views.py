from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied

from .models import Organization, Membership
from .serializers import (
    OrganizationSerializer,
    MembershipSerializer
)


class OrganizationListAPIView(generics.ListAPIView):

    serializer_class = OrganizationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):

        return Organization.objects.filter(
            memberships__user=self.request.user,
            memberships__status=Membership.Status.ACTIVE,
            is_active=True
        ).distinct().order_by("name")


class OrganizationMembersAPIView(generics.ListAPIView):

    serializer_class = MembershipSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):

        organization_id = self.kwargs["organization_id"]

        is_member = Membership.objects.filter(
            organization_id=organization_id,
            user=self.request.user,
            status=Membership.Status.ACTIVE
        ).exists()

        if not is_member:
            raise PermissionDenied(
                "You are not an active member of this organization."
            )

        return Membership.objects.filter(
            organization_id=organization_id
        ).select_related("user").order_by("created_at")