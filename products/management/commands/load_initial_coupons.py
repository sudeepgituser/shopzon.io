from django.core.management.base import BaseCommand
from django.core.management import call_command
from orders.models import Coupon


class Command(BaseCommand):
    help = "Loads initial coupon data from coupons_data.json, but only if the Coupon table is currently empty. Safe to run on every deploy."

    def handle(self, *args, **options):
        if Coupon.objects.exists():
            self.stdout.write(self.style.WARNING(
                "Coupons already exist (%d found) -- skipping load." % Coupon.objects.count()
            ))
            return

        call_command("loaddata", "coupons_data.json")
        self.stdout.write(self.style.SUCCESS(
            "Loaded %d coupons." % Coupon.objects.count()
        ))
