import uuid
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Order, Coupon
from .serializers import OrderSerializer, OrderCreateSerializer, AdminOrderSerializer, AdminOrderUpdateSerializer
from django.core.mail import send_mail
from django.conf import settings
from django.db.models import Sum, Count, F
from django.db.models.functions import TruncDate
from datetime import timedelta
from .models import OrderItem


class OrderListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(user=self.request.user)

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return OrderCreateSerializer
        return OrderSerializer

    def get_serializer_context(self):
        return {'request': self.request}

    def create(self, request, *args, **kwargs):
        write_serializer = self.get_serializer(data=request.data)
        write_serializer.is_valid(raise_exception=True)
        order = write_serializer.save()

        read_serializer = OrderSerializer(order)
        return Response(read_serializer.data, status=status.HTTP_201_CREATED)


class ConfirmPaymentView(APIView):
    # Called by the (simulated) payment gateway page once "payment"
    # succeeds. Works for both a fresh online order AND a COD order
    # whose customer chose to Pay Now instead of waiting for delivery.
    # In a real integration, verify the gateway's signed webhook here
    # instead of trusting the frontend.
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, order_id):
        try:
            order = Order.objects.get(id=order_id, user=request.user)
        except Order.DoesNotExist:
            return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        if order.payment_status in ('paid', 'cash_collected'):
            return Response({'error': 'This order has already been paid.'}, status=status.HTTP_400_BAD_REQUEST)

        order.payment_method = 'online'
        order.payment_status = 'paid'
        order.transaction_id = 'TXN' + uuid.uuid4().hex[:12].upper()
        order.payment_date = timezone.now()
        # Demo simplification: successful payment also marks the order
        # delivered immediately, same as Collect Cash does for COD.
        order.order_status = 'delivered'
        order.save()

        return Response(OrderSerializer(order).data, status=status.HTTP_200_OK)


class AdminOrderListView(generics.ListAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = AdminOrderSerializer

    def get_queryset(self):
        return Order.objects.all()


class AdminOrderUpdateView(generics.UpdateAPIView):
    permission_classes = [permissions.IsAdminUser]
    queryset = Order.objects.all()
    serializer_class = AdminOrderUpdateSerializer
    http_method_names = ['patch']

    def patch(self, request, *args, **kwargs):
        order = self.get_object()

        # A cancelled order is locked -- admin cannot process/ship/
        # deliver it, and cannot re-open it through this endpoint.
        if order.order_status == 'cancelled':
            return Response(
                {'error': 'This order is cancelled and cannot be updated.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = self.get_serializer(order, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(AdminOrderSerializer(order).data, status=status.HTTP_200_OK)


class CancelOrderView(APIView):
    # POST /api/orders/<id>/cancel/
    # Customer cancels their own order. Any order can be cancelled
    # regardless of current status, per business rule. Sets a full
    # audit trail and, for online-paid orders, marks a simulated
    # refund as initiated. Also emails the customer a confirmation.
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, order_id):
        try:
            order = Order.objects.get(id=order_id, user=request.user)
        except Order.DoesNotExist:
            return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        if order.order_status == 'cancelled':
            return Response({'error': 'This order is already cancelled.'}, status=status.HTTP_400_BAD_REQUEST)

        reason = request.data.get('reason', '').strip()

        order.order_status = 'cancelled'
        order.cancelled_by = request.user
        order.cancelled_at = timezone.now()
        order.cancellation_reason = reason

        # Simulated refund handling -- COD with nothing collected yet
        # needs no refund. Anything already paid (online, or COD cash
        # already collected) gets a simulated "Refund Initiated".
        if order.payment_status in ('paid', 'cash_collected'):
            order.refund_status = 'refund_initiated'

        order.save(update_fields=[
            'order_status', 'cancelled_by', 'cancelled_at',
            'cancellation_reason', 'refund_status',
        ])

        # Best-effort email -- cancellation itself should still succeed
        # even if the email send fails for any reason.
        if order.user.email:
            try:
                subject = 'Your Shopzon Order #{} has been cancelled'.format(order.id)
                message = (
                    'Hi {},\n\n'
                    'Your order #{} was cancelled on {}.\n\n'
                    '{}'
                    'Order Total: Rs.{}\n\n'
                    'If you have any questions, just reply to this email.\n\n'
                    'Thank you for shopping with Shopzon.'
                ).format(
                    order.user.username,
                    order.id,
                    order.cancelled_at.strftime('%d %B %Y, %I:%M %p'),
                    'A refund has been initiated and will be processed shortly.\n\n' if order.refund_status == 'refund_initiated' else '',
                    order.total,
                )
                send_mail(
                    subject, message, settings.DEFAULT_FROM_EMAIL,
                    [order.user.email], fail_silently=True,
                )
            except Exception:
                pass

        return Response(OrderSerializer(order).data, status=status.HTTP_200_OK)


class AdminCollectCashView(APIView):
    # POST /api/orders/admin/<id>/collect-cash/
    # Admin-only. Called when the admin has physically received cash
    # from the customer for a COD order. Records who confirmed it and
    # when, so there's a real audit trail -- this is deliberately NOT
    # something the customer can trigger themselves.
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, pk):
        try:
            order = Order.objects.get(pk=pk)
        except Order.DoesNotExist:
            return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        if order.payment_method != 'cod':
            return Response({'error': 'This order is not Cash on Delivery.'}, status=status.HTTP_400_BAD_REQUEST)

        if order.payment_status == 'cash_collected':
            return Response({'error': 'Cash has already been marked as collected for this order.'}, status=status.HTTP_400_BAD_REQUEST)

        if order.payment_status == 'paid':
            return Response({'error': 'This order was already paid online.'}, status=status.HTTP_400_BAD_REQUEST)

        order.payment_status = 'cash_collected'
        order.collected_by = request.user
        order.collected_at = timezone.now()
        # COD cash is physically collected at the doorstep, so the order
        # is delivered at the same moment -- no separate manual step.
        order.order_status = 'delivered'
        order.save(update_fields=['payment_status', 'collected_by', 'collected_at', 'order_status'])

        return Response(AdminOrderSerializer(order).data, status=status.HTTP_200_OK)


class NotifyDeliveryView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, order_id):
        try:
            order = Order.objects.get(id=order_id)
        except Order.DoesNotExist:
            return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not order.user.email:
            return Response({'error': 'This customer has no email on file.'}, status=status.HTTP_400_BAD_REQUEST)

        delivery_date = order.estimated_delivery.strftime('%d %B %Y') if order.estimated_delivery else 'soon'

        subject = 'Your Shopzon Order #{} is on its way!'.format(order.id)
        message = (
            'Hi {},\n\n'
            'Good news! Your order #{} is scheduled for delivery on {}.\n\n'
            'Order Total: Rs.{}\n'
            'Delivery Address: {}\n\n'
            'Thank you for shopping with Shopzon.'
        ).format(order.user.username, order.id, delivery_date, order.total, order.delivery_address)

        try:
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [order.user.email],
                fail_silently=False,
            )
        except Exception as e:
            return Response({'error': 'Failed to send email: ' + str(e)}, status=status.HTTP_502_BAD_GATEWAY)

        return Response({'success': True, 'message': 'Email sent to ' + order.user.email})


class NotifyWhatsAppView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, order_id):
        try:
            order = Order.objects.get(id=order_id)
        except Order.DoesNotExist:
            return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        delivery_date = order.estimated_delivery.strftime('%d %B %Y') if order.estimated_delivery else 'soon'
        simulated_message = (
            'Hi {}, your Shopzon order #{} is scheduled for delivery on {}. '
            'Total: Rs.{}'
        ).format(order.user.username, order.id, delivery_date, order.total)

        print('[SIMULATED WHATSAPP] To user:', order.user.username, '| Message:', simulated_message)

        return Response({
            'success': True,
            'message': '(Demo) WhatsApp message simulated for ' + order.user.username,
            'simulated_text': simulated_message,
        })

class AdminAnalyticsView(APIView):
    # GET /api/orders/admin/analytics/
    # Aggregated numbers for the admin dashboard: revenue over the last
    # 30 days, top-selling products, and a breakdown of orders by status.
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        thirty_days_ago = timezone.now() - timedelta(days=30)

        # ---- Overview numbers ----
        all_orders = Order.objects.exclude(order_status='cancelled')
        total_revenue = all_orders.aggregate(total=Sum('total'))['total'] or 0
        total_orders = all_orders.count()
        total_customers = Order.objects.values('user').distinct().count()

        # ---- Revenue per day, last 30 days (for a line chart) ----
        # Fill every day in the range with 0 first, so days with no
        # orders still show up as a real point on the chart (instead of
        # the line appearing to just stop).
        today = timezone.now().date()
        revenue_by_day_map = {
            (today - timedelta(days=i)).isoformat(): {'revenue': 0.0, 'orders': 0}
            for i in range(29, -1, -1)
        }

        daily = (
            all_orders
            .filter(created_at__gte=thirty_days_ago)
            .annotate(day=TruncDate('created_at'))
            .values('day')
            .annotate(revenue=Sum('total'), order_count=Count('id'))
            .order_by('day')
        )
        for entry in daily:
            key = entry['day'].isoformat()
            if key in revenue_by_day_map:
                revenue_by_day_map[key] = {
                    'revenue': float(entry['revenue']),
                    'orders': entry['order_count'],
                }

        revenue_by_day = [
            {'date': date, 'revenue': data['revenue'], 'orders': data['orders']}
            for date, data in revenue_by_day_map.items()
        ]

        # ---- Top 10 products by units sold (for a bar chart) ----
        top_products_qs = (
            OrderItem.objects
            .exclude(order__order_status='cancelled')
            .values('title')
            .annotate(units_sold=Sum('quantity'), revenue=Sum(F('price') * F('quantity')))
            .order_by('-units_sold')[:10]
        )
        top_products = [
            {
                'title': p['title'],
                'units_sold': p['units_sold'],
                'revenue': float(p['revenue']),
            }
            for p in top_products_qs
        ]

        # ---- Orders by status (for a pie chart) ----
        status_breakdown_qs = (
            Order.objects
            .values('order_status')
            .annotate(count=Count('id'))
            .order_by('-count')
        )
        status_breakdown = [
            {'status': s['order_status'], 'count': s['count']}
            for s in status_breakdown_qs
        ]

        return Response({
            'total_revenue': float(total_revenue),
            'total_orders': total_orders,
            'total_customers': total_customers,
            'revenue_by_day': revenue_by_day,
            'top_products': top_products,
            'status_breakdown': status_breakdown,
        })

class ApplyCouponView(APIView):
    # POST /api/orders/apply-coupon/  with {code, order_total}
    # Validates a coupon code against the current cart total and
    # returns the discount amount if valid. Doesn't touch the database
    # (times_used only increments when the order is actually placed).
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        code = request.data.get('code', '').strip().upper()
        order_total = request.data.get('order_total')

        if not code:
            return Response({'error': 'Please enter a coupon code.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order_total = float(order_total)
        except (TypeError, ValueError):
            return Response({'error': 'Invalid order total.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            coupon = Coupon.objects.get(code__iexact=code)
        except Coupon.DoesNotExist:
            return Response({'error': 'Invalid coupon code.'}, status=status.HTTP_404_NOT_FOUND)

        if not coupon.is_valid_now():
            return Response({'error': 'This coupon is no longer valid.'}, status=status.HTTP_400_BAD_REQUEST)

        if order_total < float(coupon.min_order_amount):
            return Response({
                'error': f'This coupon requires a minimum order of Rs.{coupon.min_order_amount}.'
            }, status=status.HTTP_400_BAD_REQUEST)

        discount = float(coupon.calculate_discount(order_total))

        return Response({
            'valid': True,
            'code': coupon.code,
            'discount_amount': discount,
            'new_total': round(order_total - discount, 2),
        })