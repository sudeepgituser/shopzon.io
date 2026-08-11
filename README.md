\# Shopzon — Full-Stack E-Commerce Clone



A complete Amazon-style e-commerce site built with Django REST Framework (backend) and vanilla HTML/CSS/JS (frontend), deployed live on Render with PostgreSQL.



\*\*Live site:\*\* https://shopzon-qy3x.onrender.com



\## Features



\- \*\*Authentication\*\* — JWT-based login/signup with automatic token refresh

\- \*\*Product catalog\*\* — Database-driven product listings with categories, ratings, and search

\- \*\*Cart \& Checkout\*\* — Multi-step checkout with saved addresses and payment method selection

\- \*\*Payments\*\* — Cash on Delivery and simulated online payment, with coupon code support

\- \*\*Order management\*\* — Order tracking, cancellation with refund status, order history

\- \*\*Admin panel\*\* — Order management, Collect Cash workflow, customer notifications (email via Resend, WhatsApp simulation)

\- \*\*Analytics dashboard\*\* — Revenue, top products, and order status charts (Chart.js)

\- \*\*Reviews\*\* — Product ratings and reviews



\## Tech Stack



\- \*\*Backend:\*\* Django, Django REST Framework, Simple JWT

\- \*\*Database:\*\* PostgreSQL

\- \*\*Frontend:\*\* Vanilla HTML/CSS/JavaScript

\- \*\*Email:\*\* Resend API

\- \*\*Hosting:\*\* Render



\## Local Setup



1\. Clone the repo and create a virtual environment:

```bash

&#x20;  python -m venv myenv

&#x20;  myenv\\Scripts\\activate  # Windows

&#x20;  pip install -r requirements.txt

```



2\. Create a `.env` file in the project root:

DJANGO\_SECRET\_KEY=your-secret-key

DB\_NAME=shopzon\_db

DB\_USER=your-local-postgres-user

DB\_PASSWORD=your-local-postgres-password

DB\_HOST=localhost

DB\_PORT=5432

GMAIL\_ADDRESS=your-email@gmail.com

GMAIL\_APP\_PASSWORD=your-gmail-app-password

RESEND\_API\_KEY=your-resend-api-key



3\. Run migrations and start the server:

```bash

&#x20;  python manage.py migrate

&#x20;  python manage.py runserver

```



4\. Open `frontend/index.html` with a local server (e.g. VS Code Live Server).



\## Deployment



Deployed on Render as a single web service serving both the Django API and static frontend files. See `Build Command` in Render settings for the deploy pipeline (migrations + safe initial data loaders for products/coupons).

