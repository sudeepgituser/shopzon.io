from django.core.management.base import BaseCommand
from django.core.management import call_command
from products.models import Product


class Command(BaseCommand):
    help = "Loads initial product data from products_data.json, but only if the Product table is currently empty. Safe to run on every deploy."

    def handle(self, *args, **options):
        if Product.objects.exists():
            self.stdout.write(self.style.WARNING(
                "Products already exist (%d found) -- skipping load." % Product.objects.count()
            ))
            return

        call_command("loaddata", "products_data.json")
        self.stdout.write(self.style.SUCCESS(
            "Loaded %d products." % Product.objects.count()
        ))
