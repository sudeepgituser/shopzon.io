from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status

from products.models import Product
from orders.models import Order


class OrderCreationTests(APITestCase):
    def setUp(self):
        # A regular customer account, logged in for every test in this class.
        self.user = User.objects.create_user(username='customer1', password='testpass123')
        self.client.force_authenticate(user=self.user)

        self.product = Product.objects.create(
            title='Test Lamp',
            price=999,
            category='lamp',
            description='A lamp for testing',
            image='test.jpg',
            stock_quantity=5,
        )

    def test_create_order_with_valid_stock_succeeds(self):
        """Ordering less than or equal to available stock should succeed."""
        response = self.client.post('/api/orders/', {
            'items': [{'product_id': self.product.id, 'quantity': 2}],
            'delivery_address': '123 Test Street',
            'payment_method': 'cod',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Order.objects.count(), 1)
        self.assertEqual(float(response.data['total']), 999 * 2)

    def test_create_order_decrements_stock(self):
        """Placing an order should reduce the product's stock_quantity."""
        self.client.post('/api/orders/', {
            'items': [{'product_id': self.product.id, 'quantity': 2}],
            'delivery_address': '123 Test Street',
            'payment_method': 'cod',
        }, format='json')

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 3)  # 5 - 2

    def test_create_order_exceeding_stock_fails(self):
        """Ordering more than available stock should be rejected with a
        clear error, and no order should be created."""
        response = self.client.post('/api/orders/', {
            'items': [{'product_id': self.product.id, 'quantity': 999}],
            'delivery_address': '123 Test Street',
            'payment_method': 'cod',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('stock_error', response.data)
        self.assertEqual(Order.objects.count(), 0)

        # Stock should be untouched since the order was rejected.
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 5)

    def test_create_order_with_zero_stock_product_fails(self):
        """A product with 0 stock should always be rejected."""
        self.product.stock_quantity = 0
        self.product.save()

        response = self.client.post('/api/orders/', {
            'items': [{'product_id': self.product.id, 'quantity': 1}],
            'delivery_address': '123 Test Street',
            'payment_method': 'cod',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)

    def test_unauthenticated_user_cannot_create_order(self):
        """Logging out (no auth) should block order creation entirely."""
        self.client.force_authenticate(user=None)

        response = self.client.post('/api/orders/', {
            'items': [{'product_id': self.product.id, 'quantity': 1}],
            'delivery_address': '123 Test Street',
            'payment_method': 'cod',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_customer_only_sees_their_own_orders(self):
        """A customer should never see another customer's orders in the
        list endpoint."""
        other_user = User.objects.create_user(username='customer2', password='testpass123')
        Order.objects.create(user=other_user, total=500, delivery_address='Someone else\'s house')
        Order.objects.create(user=self.user, total=999, delivery_address='My house')

        response = self.client.get('/api/orders/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['delivery_address'], 'My house')


class AdminOrderPermissionTests(APITestCase):
    def setUp(self):
        self.regular_user = User.objects.create_user(username='regular', password='testpass123')
        self.admin_user = User.objects.create_user(username='admin1', password='testpass123', is_staff=True)

    def test_regular_user_cannot_access_admin_order_list(self):
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get('/api/orders/admin/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_user_can_access_admin_order_list(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/orders/admin/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_unauthenticated_cannot_access_admin_order_list(self):
        response = self.client.get('/api/orders/admin/')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))