from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from rest_framework import status


class RegistrationTests(APITestCase):
    def test_register_with_valid_data_succeeds(self):
        response = self.client.post('/api/auth/register/', {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'strongpass123',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username='newuser').exists())

    def test_register_with_duplicate_username_fails(self):
        User.objects.create_user(username='existinguser', password='pass123456')

        response = self.client.post('/api/auth/register/', {
            'username': 'existinguser',
            'email': 'other@example.com',
            'password': 'strongpass123',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_with_short_password_fails(self):
        response = self.client.post('/api/auth/register/', {
            'username': 'newuser2',
            'email': 'newuser2@example.com',
            'password': '123',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_password_is_hashed_not_stored_in_plaintext(self):
        self.client.post('/api/auth/register/', {
            'username': 'newuser3',
            'email': 'newuser3@example.com',
            'password': 'strongpass123',
        }, format='json')

        user = User.objects.get(username='newuser3')
        self.assertNotEqual(user.password, 'strongpass123')
        self.assertTrue(user.password.startswith('pbkdf2_'))


class LoginTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='loginuser', password='correctpass123')

    def test_login_with_correct_credentials_succeeds(self):
        response = self.client.post('/api/auth/login/', {
            'username': 'loginuser',
            'password': 'correctpass123',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_login_with_wrong_password_fails(self):
        response = self.client.post('/api/auth/login/', {
            'username': 'loginuser',
            'password': 'wrongpassword',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_with_nonexistent_username_fails(self):
        response = self.client.post('/api/auth/login/', {
            'username': 'doesnotexist',
            'password': 'anything123',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)