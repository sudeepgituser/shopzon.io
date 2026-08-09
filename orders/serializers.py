from django.utils import timezone
from datetime import timedelta
from django.db.models import Avg
from rest_framework import serializers
from products.models import Product
from .models import Order, OrderItem, Coupon


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ["id", "title", "image", "price", "quantity"]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    payment_method_display = serializers.CharField(source="get_payment_method_display", read_only=True)
    payment_status_display = serializers.CharField(source="get_payment_status_display", read_only=True)
    order_status_display = serializers.CharField(source="get_order_status_display", read_only=True)
    collected_by_username = serializers.CharField(source="collected_by.username", read_only=True, default=None)
    cancelled_by_username = serializers.CharField(source="cancelled_by.username", read_only=True, default=None)
    refund_status_display = serializers.CharField(source="get_refund_status_display", read_only=True)

    tracking_step = serializers.SerializerMethodField()
    tracking_label = serializers.SerializerMethodField()

    def get_tracking_step(self, obj):
        return obj.get_tracking_info()['step']

    def get_tracking_label(self, obj):
        return obj.get_tracking_info()['label']

    class Meta:
        model = Order
        fields = [
            "id", "created_at", "total", "items",
            "delivery_address", "estimated_delivery",
            "payment_method", "payment_method_display",
            "payment_status", "payment_status_display",
            "order_status", "order_status_display",
            "tracking_step", "tracking_label",
            "transaction_id", "payment_date",
            "collected_by_username", "collected_at",
            "cancelled_by_username", "cancelled_at",
            "cancellation_reason", "refund_status", "refund_status_display",
            "coupon_code", "discount_amount",
        ]


class AdminOrderSerializer(OrderSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.CharField(source="user.email", read_only=True)

    class Meta(OrderSerializer.Meta):
        fields = OrderSerializer.Meta.fields + ["username", "email", "is_flagged", "risk_reasons"]


class OrderItemInputSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)

def check_order_risk(user, order_total):
    """Returns a list of human-readable reasons this order looks risky,
    or an empty list if it looks normal. Purely a heuristic -- flags
    for admin review, never auto-blocks an order."""
    reasons = []
    now = timezone.now()

    # Rule 1: brand-new account placing a high-value order.
    account_age = now - user.date_joined
    if account_age < timedelta(hours=24) and order_total > 5000:
        reasons.append(
            f'New account (joined {round(account_age.total_seconds() / 3600, 1)}h ago) '
            f'placing a high-value order.'
        )

    # Rule 2: too many orders in a short window.
    recent_orders = Order.objects.filter(
        user=user, created_at__gte=now - timedelta(hours=1)
    ).count()
    if recent_orders >= 3:
        reasons.append(f'{recent_orders} orders placed by this user in the last hour.')

    # Rule 3: order is much larger than this user's usual spending.
    past_orders = Order.objects.filter(user=user).exclude(order_status='cancelled')
    avg_total = past_orders.aggregate(avg=Avg('total'))['avg']
    if avg_total and order_total > float(avg_total) * 5:
        reasons.append(
            f'Order total (Rs.{order_total:.0f}) is over 5x this user\'s average order '
            f'(Rs.{avg_total:.0f}).'
        )

    return reasons

class OrderCreateSerializer(serializers.Serializer):
    items = OrderItemInputSerializer(many=True)
    delivery_address = serializers.CharField(max_length=1000)
    payment_method = serializers.ChoiceField(choices=["cod", "online"])
    coupon_code = serializers.CharField(max_length=30, required=False, allow_blank=True)
    
    def validate(self, data):
        # Check stock BEFORE creating anything, so we never end up with
        # a half-created order if one item is out of stock.
        errors = []
        for item_data in data["items"]:
            try:
                product = Product.objects.get(id=item_data["product_id"])
            except Product.DoesNotExist:
                continue

            if item_data["quantity"] > product.stock_quantity:
                if product.stock_quantity == 0:
                    errors.append(f'"{product.title}" is out of stock.')
                else:
                    errors.append(
                        f'Only {product.stock_quantity} left of "{product.title}" '
                        f'(you requested {item_data["quantity"]}).'
                    )

        if errors:
            raise serializers.ValidationError({"stock_error": errors})

        return data

    def create(self, validated_data):
        user = self.context["request"].user
        items_data = validated_data["items"]

        order = Order.objects.create(
            user=user,
            total=0,
            delivery_address=validated_data["delivery_address"],
            payment_method=validated_data["payment_method"],
            payment_status="pending",
        )
        total = 0

        for item_data in items_data:
            try:
                product = Product.objects.get(id=item_data["product_id"])
            except Product.DoesNotExist:
                continue

            quantity = item_data["quantity"]
            OrderItem.objects.create(
                order=order,
                product=product,
                title=product.title,
                image=product.image,
                price=product.price,
                quantity=quantity,
            )
            total += product.price * quantity

          # Reduce stock now that the order item is confirmed created.
            product.stock_quantity -= quantity
            product.save()
        # Apply coupon discount, if a valid one was provided.
        coupon_code = validated_data.get("coupon_code", "").strip()
        if coupon_code:
            from .models import Coupon
            try:
                coupon = Coupon.objects.get(code__iexact=coupon_code)
                if coupon.is_valid_now() and total >= coupon.min_order_amount:
                    discount = coupon.calculate_discount(total)
                    order.coupon_code = coupon.code
                    order.discount_amount = discount
                    total = total - discount
                    coupon.times_used += 1
                    coupon.save()
            except Coupon.DoesNotExist:
                pass  # Invalid code silently ignored at order-creation time --
                      # the frontend should have already validated it via
                      # /apply-coupon/ before reaching this point.

        order.total = total

        # Run fraud/risk heuristics on the finished order before saving.
        risk_reasons = check_order_risk(user, float(total))
        if risk_reasons:
            order.is_flagged = True
            order.risk_reasons = ' | '.join(risk_reasons)

        order.save()
        return order

class AdminOrderUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = ["order_status", "payment_status", "delivery_address"]
        extra_kwargs = {
            "order_status": {"required": False},
            "payment_status": {"required": False},
            "delivery_address": {"required": False},
        }
