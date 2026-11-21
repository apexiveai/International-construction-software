from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    RegisterSerializer,
    UserSerializer
)


class RegisterAPIView(generics.GenericAPIView):

    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request):

        serializer = self.get_serializer(
            data=request.data
        )

        serializer.is_valid(raise_exception=True)

        user = serializer.save()

        refresh = RefreshToken.for_user(user)

        return Response({
            "user": UserSerializer(user).data,
            "tokens": {
                "refresh": str(refresh),
                "access": str(refresh.access_token)
            }
        }, status=201)


class MeAPIView(APIView):

    permission_classes = [
        permissions.IsAuthenticated
    ]

    def get(self, request):

        return Response(
            UserSerializer(request.user).data
        )

    def patch(self, request):

        serializer = UserSerializer(
            request.user,
            data=request.data,
            partial=True
        )

        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data)