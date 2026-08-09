from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from rest_framework import generics
from .models import Product
from .serializers import ProductSerializer
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from .models import Review
from .serializers import ReviewSerializer
from orders.models import OrderItem
from rest_framework.views import APIView


class ProductReviewListCreateView(generics.ListCreateAPIView):
    # GET /api/products/<product_id>/reviews/  -> list reviews for a product
    # POST /api/products/<product_id>/reviews/ -> add a review (one per user per product)
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        return Review.objects.filter(product_id=self.kwargs["product_id"])

    def perform_create(self, serializer):
        product_id = self.kwargs["product_id"]
        user = self.request.user

        if Review.objects.filter(product_id=product_id, user=user).exists():
            raise ValidationError({"error": "You have already reviewed this product."})

        has_purchased = OrderItem.objects.filter(
            product_id=product_id, order__user=user
        ).exclude(order__order_status="cancelled").exists()

        if not has_purchased:
            raise ValidationError({"error": "You can only review products you have purchased."})

        serializer.save(product_id=product_id, user=user)
 
@method_decorator(cache_page(300), name='dispatch')
class ProductListView(generics.ListAPIView):
    # GET /api/products/  -> returns all products as JSON
    # cache_page(300) means: remember this answer for 300 seconds (5 min),
    # so repeated visits don't hit the database every single time.
    queryset = Product.objects.all()
    serializer_class = ProductSerializer

 
 
class ProductDetailView(generics.RetrieveAPIView):
    # GET /api/products/<id>/  -> returns one product as JSON
    queryset = Product.objects.all()
    serializer_class = ProductSerializer

class ProductReviewEligibilityView(APIView):
    # GET /api/products/<product_id>/can-review/
    # Tells the frontend whether the logged-in user is allowed to write
    # a review for this product, and why not if they can't -- so the UI
    # can show the right message instead of a blank/confusing form.
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, product_id):
        user = request.user

        already_reviewed = Review.objects.filter(product_id=product_id, user=user).exists()
        if already_reviewed:
            return Response({'can_review': False, 'reason': 'already_reviewed'})

        has_purchased = OrderItem.objects.filter(
            product_id=product_id, order__user=user
        ).exclude(order__order_status='cancelled').exists()

        if not has_purchased:
            return Response({'can_review': False, 'reason': 'not_purchased'})

        return Response({'can_review': True}) 