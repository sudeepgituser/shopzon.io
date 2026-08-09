from django.urls import path
from .views import ProductListView, ProductDetailView, ProductReviewListCreateView, ProductReviewEligibilityView

urlpatterns = [
    path("products/", ProductListView.as_view(), name="product-list"),
    path("products/<int:pk>/", ProductDetailView.as_view(), name="product-detail"),
    path("products/<int:product_id>/reviews/", ProductReviewListCreateView.as_view(), name="product-reviews"),
    path("products/<int:product_id>/can-review/", ProductReviewEligibilityView.as_view(), name="product-can-review"),
]