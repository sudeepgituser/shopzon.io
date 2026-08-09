from django.contrib.auth.models import User
from rest_framework import serializers


class RegisterSerializer(serializers.ModelSerializer):
    # write_only means this field is accepted in the request but never
    # sent back out in a response -- we don't want to ever echo passwords.
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ["id", "username", "email", "password"]

    def create(self, validated_data):
        # create_user() hashes the password properly -- never store
        # plain-text passwords, and this is Django's built-in safe way
        # to avoid that mistake.
        return User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
        )

from .models import Address


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = ["id", "full_name", "mobile", "email", "address_line", "city", "state", "pincode", "is_default"]