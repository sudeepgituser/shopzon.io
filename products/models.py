from django.db import models


class Product(models.Model):
    # These fields match products.js exactly, so migrating the frontend
    # from hardcoded data to this database won't lose any information.

    BADGE_CHOICES = [
        ("best-seller", "Best Seller"),
        ("amazons-choice", "Amazon's Choice"),
        ("limited-deal", "Limited Deal"),
    ]

    title = models.CharField(max_length=200)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    original_price = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    rating = models.DecimalField(max_digits=2, decimal_places=1, default=0)
    review_count = models.PositiveIntegerField(default=0)
    badge = models.CharField(
        max_length=20, choices=BADGE_CHOICES, null=True, blank=True
    )
    image = models.CharField(max_length=200)  # filename, e.g. "box3_image.jpg"
    category = models.CharField(max_length=50)
    description = models.TextField()
    stock_quantity = models.PositiveIntegerField(default=10)

    def __str__(self):
        return self.title

    def update_rating_summary(self):
        """Recalculates this product's average rating and review count
        from its actual Review objects. Called automatically whenever a
        review is saved or deleted."""
        from django.db.models import Avg, Count
        summary = self.reviews.aggregate(avg=Avg('rating'), count=Count('id'))
        self.rating = round(summary['avg'] or 0, 1)
        self.review_count = summary['count'] or 0
        self.save(update_fields=['rating', 'review_count'])

class Review(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='reviews')
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE, related_name='product_reviews')
    rating = models.PositiveSmallIntegerField()  # 1-5
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ['product', 'user']  # one review per user per product

    def __str__(self):
        return f"{self.user.username} rated {self.product.title}: {self.rating}/5"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.product.update_rating_summary()

    def delete(self, *args, **kwargs):
        product = self.product
        super().delete(*args, **kwargs)
        product.update_rating_summary()