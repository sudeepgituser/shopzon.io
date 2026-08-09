from django.test import TestCase
from rest_framework.test import APITestCase
from rest_framework import status

from products.models import Product


class ProductListTests(APITestCase):
    def setUp(self):
        Product.objects.create(
            title='Test Toy', price=499, category='toys',
            description='A toy', image='toy.jpg', stock_quantity=10,
        )
        Product.objects.create(
            title='Test Lamp', price=1299, category='lamp',
            description='A lamp', image='lamp.jpg', stock_quantity=0,
        )

    def test_product_list_returns_all_products(self):
        response = self.client.get('/api/products/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_product_list_includes_stock_quantity(self):
        """Regression test -- stock_quantity must actually be exposed in
        the API response, since the frontend depends on it to show
        In Stock / Out of Stock correctly."""
        response = self.client.get('/api/products/')
        titles_to_stock = {p['title']: p['stock_quantity'] for p in response.data}
        self.assertEqual(titles_to_stock['Test Toy'], 10)
        self.assertEqual(titles_to_stock['Test Lamp'], 0)

    def test_product_detail_returns_single_product(self):
        product = Product.objects.get(title='Test Toy')
        response = self.client.get(f'/api/products/{product.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], 'Test Toy')

    def test_product_detail_404_for_nonexistent_product(self):
        response = self.client.get('/api/products/99999/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)