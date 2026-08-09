from rest_framework import serializers
from .models import Product, Review


class ProductSerializer(serializers.ModelSerializer):
    # These aliases make the JSON output match the field names your
    # frontend JS already uses (products.js style: camelCase), even
    # though the database itself uses snake_case (Python/Django style).
    originalPrice = serializers.DecimalField(
        source="original_price", max_digits=10, decimal_places=2,
        allow_null=True, required=False
    )
    reviewCount = serializers.IntegerField(source="review_count")

    class Meta:
        model = Product
        fields = [
            "id",
            "title",
            "price",
            "originalPrice",
            "rating",
            "reviewCount",
            "badge",
            "image",
            "category",
            "description",
            "stock_quantity",
        ]

class ReviewSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = Review
        fields = ["id", "product", "username", "rating", "comment", "created_at"]
        read_only_fields = ["id", "username", "created_at"]
        extra_kwargs = {
            "product": {"write_only": True},
        }

    def validate_rating(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError("Rating must be between 1 and 5.")
        return value        