from django.urls import path
from .views import (
    OrderListCreateView, AdminOrderListView, AdminOrderUpdateView,
    ConfirmPaymentView, AdminCollectCashView, CancelOrderView,
    NotifyDeliveryView, NotifyWhatsAppView, AdminAnalyticsView, 
    ApplyCouponView, AdminRevenueAnalyticsView
)

urlpatterns = [
    path('', OrderListCreateView.as_view(), name='order-list-create'),
    path('admin/', AdminOrderListView.as_view(), name='admin-order-list'),
    path('admin/analytics/', AdminAnalyticsView.as_view(), name='admin-analytics'),
    path('admin/<int:pk>/update/', AdminOrderUpdateView.as_view(), name='admin-order-update'),
    path('admin/<int:order_id>/notify/', NotifyDeliveryView.as_view(), name='notify-delivery'),
    path('admin/<int:order_id>/notify-whatsapp/', NotifyWhatsAppView.as_view(), name='notify-whatsapp'),
    path('admin/<int:pk>/collect-cash/', AdminCollectCashView.as_view(), name='admin-collect-cash'),
    path('<int:order_id>/confirm-payment/', ConfirmPaymentView.as_view(), name='confirm-payment'),
    path('<int:order_id>/cancel/', CancelOrderView.as_view(), name='cancel-order'),
    path('admin/analytics/revenue/', AdminRevenueAnalyticsView.as_view(), name='admin-revenue-analytics'),
    path('apply-coupon/', ApplyCouponView.as_view(), name='apply-coupon'),
]
