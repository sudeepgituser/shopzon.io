from django.contrib.auth.models import User
u = User.objects.get(username='sudeep')
u.is_staff = True
u.save()