from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import RegisterView, AddressListCreateView, PasswordResetRequestView, PasswordResetConfirmView
from .token_views import CustomTokenObtainPairView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", CustomTokenObtainPairView.as_view(), name="login"),
    path("refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("addresses/", AddressListCreateView.as_view(), name="address-list-create"),
    path("password-reset/", PasswordResetRequestView.as_view(), name="password-reset"),
    path("password-reset-confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
]