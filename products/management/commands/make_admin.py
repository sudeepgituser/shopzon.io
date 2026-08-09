from django.core.management.base import BaseCommand
from django.contrib.auth.models import User


class Command(BaseCommand):
    help = "Promotes a user to staff+superuser by username. Usage: python manage.py make_admin <username>"

    def add_arguments(self, parser):
        parser.add_argument("username", type=str)

    def handle(self, *args, **options):
        username = options["username"]
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"No user found with username '{username}'."))
            return

        user.is_staff = True
        user.is_superuser = True
        user.save()
        self.stdout.write(self.style.SUCCESS(f"'{username}' is now staff + superuser."))
