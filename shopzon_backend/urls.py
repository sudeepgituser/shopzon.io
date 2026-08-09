"""
URL configuration for shopzon_backend project.
"""
from django.contrib import admin
from django.urls import path, re_path, include
from django.views.static import serve
from django.conf import settings

FRONTEND_DIR = settings.BASE_DIR / 'frontend'


def serve_no_cache(request, path, document_root=None, **kwargs):
    # Wraps Django's normal static file server, but adds headers that
    # tell the browser to never cache these files. This is only safe
    # for local development -- a real production deployment WOULD want
    # caching for performance, but while you're actively editing files,
    # caching just causes the "browser shows old code" bugs we kept
    # chasing earlier.
    response = serve(request, path, document_root=document_root, **kwargs)
    response['Cache-Control'] = 'no-store, no-cache, must-revalidate'
    response['Pragma'] = 'no-cache'
    return response


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('products.urls')),
    path('api/auth/', include('accounts.urls')),
    path('api/', include('chatbot.urls')),
    path('api/orders/', include('orders.urls')),

    path('', serve_no_cache, {'document_root': FRONTEND_DIR, 'path': 'index.html'}),

    re_path(r'^(?P<path>.*)$', serve_no_cache, {'document_root': FRONTEND_DIR}),
]