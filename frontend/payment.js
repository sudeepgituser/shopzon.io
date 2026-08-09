// payment.js
//
// Runs only on payment.html. Simulates a payment gateway: shows the
// amount due, a "Pay Now" button, a brief processing state, then calls
// the backend to mark the order as paid (generating a real transaction
// ID and timestamp server-side) before showing success.
//
// In a real integration, "Pay Now" would open Razorpay/Stripe's actual
// checkout widget, and the success callback would come from THEM, not
// a local setTimeout -- everything else in this flow (the order model,
// the confirm-payment endpoint, the receipt) stays the same either way.

function getOrderIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('order_id');
}

async function initPaymentPage() {
  if (!requireLogin()) {
    return;
  }

  const orderId = getOrderIdFromUrl();
  if (!orderId) {
    window.location.href = 'index.html';
    return;
  }

  // Fetch the order to show the correct amount (rather than trusting
  // anything passed through the URL, which a user could edit).
  try {
    const response = await fetch(API_URL + '/orders/', {
      headers: { 'Authorization': 'Bearer ' + getAccessToken() },
    });
    const orders = await response.json();
    const order = orders.find(function (o) { return String(o.id) === String(orderId); });

    if (!order) {
      document.getElementById('paymentBox').innerHTML = '<p>Order not found.</p>';
      return;
    }

    document.getElementById('paymentAmount').textContent =
      '\u20B9' + Number(order.total).toLocaleString('en-IN');
  } catch (error) {
    console.error('Could not load order for payment:', error);
  }

  document.getElementById('payNowBtn').addEventListener('click', function () {
    simulatePayment(orderId);
  });
}

function simulatePayment(orderId) {
  document.getElementById('paymentPending').style.display = 'none';
  document.getElementById('paymentProcessing').style.display = 'block';

  // Simulated processing delay, like a real gateway redirect/callback
  // would take a moment too.
  setTimeout(async function () {
    try {
      const response = await fetch(API_URL + '/orders/' + orderId + '/confirm-payment/', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getAccessToken() },
      });

      if (!response.ok) {
        throw new Error('Payment confirmation failed: ' + response.status);
      }

      // Payment is genuinely confirmed server-side now -- safe to clear
      // the cart.
      saveCart([]);
      updateCartBadge();

      document.getElementById('paymentProcessing').style.display = 'none';
      document.getElementById('paymentSuccess').style.display = 'block';
    } catch (error) {
      console.error('Payment confirmation error:', error);
      document.getElementById('paymentProcessing').innerHTML =
        '<p>Something went wrong confirming your payment. Please contact support with your order number.</p>';
    }
  }, 1800);
}

initPaymentPage();