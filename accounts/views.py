from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.conf import settings
from .serializers import RegisterSerializer


class RegisterView(generics.CreateAPIView):
    # POST /api/auth/register/  with {username, email, password}
    # creates a new user account. Open to anyone (not just logged-in
    # users) since that's the whole point of a signup endpoint.
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

from .models import Address
from .serializers import AddressSerializer


class AddressListCreateView(generics.ListCreateAPIView):
    # GET /api/auth/addresses/  -> list the logged-in user's saved addresses
    # POST /api/auth/addresses/ -> save a new address for them
    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        # If this new address is marked default, un-default any others
        # first, so there is only ever one default per user.
        if serializer.validated_data.get("is_default"):
            Address.objects.filter(user=self.request.user, is_default=True).update(is_default=False)
        serializer.save(user=self.request.user)

class PasswordResetRequestView(APIView):
    # POST /api/auth/password-reset/  with {email}
    # Sends a reset link to that email if an account with it exists.
    # Always returns success either way, so this endpoint can't be used
    # to check which emails are registered (a common security practice).
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip()
        generic_response = Response(
            {'message': 'If an account with that email exists, a reset link has been sent.'},
            status=status.HTTP_200_OK
        )

        if not email:
            return Response({'error': 'Please provide an email address.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return generic_response  # don't reveal whether the email exists

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        reset_link = f'http://10.106.204.28:8000/reset-password.html?uid={uid}&token={token}'

        try:
            send_mail(
                'Reset your Shopzon password',
                f'Hi {user.username},\n\nClick the link below to reset your password:\n\n{reset_link}\n\n'
                f'If you did not request this, you can safely ignore this email.\n\nThank you,\nShopzon',
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                fail_silently=True,
            )
        except Exception:
            pass  # still return the generic success message either way

        return generic_response


class PasswordResetConfirmView(APIView):
    # POST /api/auth/password-reset-confirm/  with {uid, token, new_password}
    # Validates the token and sets the new password if everything checks out.
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        uid = request.data.get('uid', '')
        token = request.data.get('token', '')
        new_password = request.data.get('new_password', '')

        if not uid or not token or not new_password:
            return Response({'error': 'Missing required fields.'}, status=status.HTTP_400_BAD_REQUEST)

        if len(new_password) < 6:
            return Response({'error': 'Password must be at least 6 characters.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({'error': 'Invalid reset link.'}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, token):
            return Response({'error': 'This reset link is invalid or has expired.'}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()

        return Response({'message': 'Password reset successfully. You can now log in.'}, status=status.HTTP_200_OK)        