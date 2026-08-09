from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from products.models import Product


PAYMENT_METHOD_CHOICES = [
    ('cod', 'Cash on Delivery'),
    ('online', 'Online Payment'),
]

PAYMENT_STATUS_CHOICES = [
    ('pending', 'Pending'),
    ('paid', 'Paid'),
    ('cash_collected', 'Cash Collected'),
    ('failed', 'Failed'),
]

ORDER_STATUS_CHOICES = [
    ('processing', 'Processing'),
    ('shipped', 'Shipped'),
    ('delivered', 'Delivered'),
    ('cancelled', 'Cancelled'),
]

REFUND_STATUS_CHOICES = [
    ('not_applicable', 'Not Applicable'),
    ('refund_initiated', 'Refund Initiated'),
    ('refunded', 'Refunded'),
]


class Order(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='orders')
    created_at = models.DateTimeField(auto_now_add=True)
    total = models.DecimalField(max_digits=10, decimal_places=2)

    delivery_address = models.TextField(default='')
    estimated_delivery = models.DateField(null=True, blank=True)

    payment_method = models.CharField(max_length=10, choices=PAYMENT_METHOD_CHOICES, default='cod')
    payment_status = models.CharField(max_length=15, choices=PAYMENT_STATUS_CHOICES, default='pending')
    order_status = models.CharField(max_length=12, choices=ORDER_STATUS_CHOICES, default='processing')

    transaction_id = models.CharField(max_length=64, null=True, blank=True)
    payment_date = models.DateTimeField(null=True, blank=True)

    coupon_code = models.CharField(max_length=30, blank=True)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    is_flagged = models.BooleanField(default=False)
    risk_reasons = models.TextField(blank=True)

    collected_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='collected_payments'
    )
    collected_at = models.DateTimeField(null=True, blank=True)

    # Cancellation audit trail.
    cancelled_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='cancelled_orders'
    )
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.CharField(max_length=255, blank=True)
    refund_status = models.CharField(max_length=20, choices=REFUND_STATUS_CHOICES, default='not_applicable')

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Order #{self.id} by {self.user.username}"

    def get_tracking_info(self):
        if self.order_status == 'cancelled':
            return {'step': -1, 'label': 'Cancelled'}

        if self.order_status == 'delivered':
            return {'step': 4, 'label': 'Delivered'}

        elapsed_minutes = (timezone.now() - self.created_at).total_seconds() / 60

        if elapsed_minutes >= 10:
            if self.payment_status in ('paid', 'cash_collected'):
                return {'step': 4, 'label': 'Delivered'}
            else:
                return {'step': 3, 'label': 'Out for Delivery'}
        elif elapsed_minutes >= 5:
            return {'step': 2, 'label': 'Shipped'}
        elif elapsed_minutes >= 2:
            return {'step': 1, 'label': 'Processing'}
        else:
            return {'step': 0, 'label': 'Order Placed'}

    def save(self, *args, **kwargs):
        if not self.estimated_delivery:
            self.estimated_delivery = timezone.now().date() + timedelta(days=5)
        super().save(*args, **kwargs)


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True)
    title = models.CharField(max_length=255)
    image = models.CharField(max_length=255, blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField()

    def line_total(self):
        return self.price * self.quantity

class Coupon(models.Model):
    DISCOUNT_TYPE_CHOICES = [
        ('percentage', 'Percentage'),
        ('fixed', 'Fixed Amount'),
    ]

    code = models.CharField(max_length=30, unique=True)
    discount_type = models.CharField(max_length=10, choices=DISCOUNT_TYPE_CHOICES, default='percentage')
    discount_value = models.DecimalField(max_digits=10, decimal_places=2)  # e.g. 10 (%) or 200 (Rs.)
    min_order_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    max_uses = models.PositiveIntegerField(null=True, blank=True)  # null = unlimited
    times_used = models.PositiveIntegerField(default=0)
    valid_from = models.DateTimeField(null=True, blank=True)
    valid_until = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.code

    def is_valid_now(self):
        now = timezone.now()
        if not self.is_active:
            return False
        if self.valid_from and now < self.valid_from:
            return False
        if self.valid_until and now > self.valid_until:
            return False
        if self.max_uses is not None and self.times_used >= self.max_uses:
            return False
        return True

    def calculate_discount(self, order_total):
        from decimal import Decimal
        order_total = Decimal(str(order_total))
        if self.discount_type == 'percentage':
            return round(order_total * (self.discount_value / Decimal('100')), 2)
        return min(self.discount_value, order_total)  # fixed amount, can't exceed total