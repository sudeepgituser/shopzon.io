from django.contrib import admin
from .models import Product


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "price", "category", "badge", "rating")
    list_filter = ("category", "badge")
    search_fields = ("title", "description")