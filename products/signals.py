from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.core.cache import cache
from .models import Product


@receiver([post_save, post_delete], sender=Product)
def clear_product_cache(sender, **kwargs):
    cache.clear()