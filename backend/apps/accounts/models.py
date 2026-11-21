from django.contrib.auth.models import AbstractUser
from django.db import models

from .managers import UserManager


class User(AbstractUser):
    username = None

    email = models.EmailField(
        unique=True,
        db_index=True
    )

    full_name = models.CharField(
        max_length=180,
        blank=True
    )

    phone_number = models.CharField(
        max_length=32,
        blank=True
    )

    job_title = models.CharField(
        max_length=120,
        blank=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return self.email