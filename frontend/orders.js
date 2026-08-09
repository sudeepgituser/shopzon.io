// orders.js
//
// Runs only on orders.html. Fetches the logged-in user's real order
// history from Django, using authFetch() (auto-refreshes an expired
// access token). Displays full order details: items with images,
// delivery address, dates, color-coded status badges, a tracking bar,
// a receipt viewer for paid online orders, and order cancellation.

const ordersContainer = document.getElementById("ordersContainer");

const ORDER_STATUS_LABELS = {
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled"
};

const PAYMENT_STATUS_LABELS = {
  pending: "Pending",
  paid: "Paid",
  cash_collected: "Payment Completed (Cash on Delivery)",
  failed: "Failed"
};

const TRACKING_STAGES = ["Order Placed", "Processing", "Shipped", "Out for Delivery", "Delivered"];

function buildTrackingBarHtml(order) {
  if (order.tracking_step === -1) {
    return "<div class=\"order-tracking order-tracking-cancelled\"><i class=\"fa-solid fa-circle-xmark\"></i> This order was cancelled</div>";
  }

  let dotsHtml = "";
  TRACKING_STAGES.forEach(function (stageLabel, index) {
    const isDone = index <= order.tracking_step;
    dotsHtml +=
      "<div class=\"tracking-stage" + (isDone ? " done" : "") + "\">" +
      "  <div class=\"tracking-dot\">" + (isDone ? "<i class=\"fa-solid fa-check\"></i>" : "") + "</div>" +
      "  <span class=\"tracking-stage-label\">" + stageLabel + "</span>" +
      "</div>";
    if (index < TRACKING_STAGES.length - 1) {
      dotsHtml += "<div class=\"tracking-line" + (index < order.tracking_step ? " done" : "") + "\"></div>";
    }
  });

  return "<div class=\"order-tracking\"><div class=\"tracking-bar\">" + dotsHtml + "</div></div>";
}

async function loadOrders() {
  if (!requireLogin()) {
    return;
  }

  try {
    const response = await authFetch(API_URL + '/orders/', {});

    if (!response.ok) {
      throw new Error("Failed to load orders: " + response.status);
    }

    const orders = await response.json();
    renderOrders(orders);
  } catch (error) {
    console.error("Could not load orders:", error);
    ordersContainer.innerHTML = "<p>Something went wrong loading your orders. Please try again.</p>";
  }
}

function formatDate(dateStr) {
  if (!dateStr) {
    return "\u2014";
  }
  return new Date(dateStr).toLocaleDateString("en-IN", {
    year: "numeric", month: "short", day: "numeric"
  });
}

function formatDateTime(dateStr) {
  if (!dateStr) {
    return "\u2014";
  }
  return new Date(dateStr).toLocaleString("en-IN", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

function renderOrders(orders) {
  if (orders.length === 0) {
    ordersContainer.innerHTML = "<p>You have no orders yet. <a href=\"index.html\">Start shopping</a>.</p>";
    return;
  }

  let html = "";

  orders.forEach(function (order) {
    let itemsHtml = "";
    order.items.forEach(function (item) {
      itemsHtml +=
        "<div class=\"order-item-row\">" +
        "  <div class=\"order-item-image\" style=\"background-image: url('" + item.image + "');\"></div>" +
        "  <div class=\"order-item-info\">" +
        "    <h3>" + item.title + "</h3>" +
        "    <p>Qty: " + item.quantity + " \u00d7 \u20B9" + Number(item.price).toLocaleString("en-IN") + "</p>" +
        "  </div>" +
        "  <div class=\"order-item-total\">\u20B9" + (item.price * item.quantity).toLocaleString("en-IN") + "</div>" +
        "</div>";
    });

    const isCancelled = order.order_status === "cancelled";

    const receiptBtn = (order.payment_method === "online" && order.payment_status === "paid" && !isCancelled)
      ? "<button class=\"view-receipt-btn\" data-order-id=\"" + order.id + "\">View / Download Receipt</button>"
      : "";

    const payNowBtn = (order.payment_status === "pending" && !isCancelled)
      ? "<a href=\"payment.html?order_id=" + order.id + "\" class=\"pay-now-btn\">Pay Now</a>"
      : "";

    const codCollectedNote = (order.payment_status === "cash_collected" && !isCancelled)
      ? "<p class=\"cod-note\"><i class=\"fa-solid fa-circle-check\"></i> Payment Completed (Cash on Delivery) &mdash; collected " + formatDateTime(order.collected_at) + "</p>"
      : "";

    // Cancel Order button -- any order not already cancelled is eligible.
    const cancelBtn = !isCancelled
      ? "<button class=\"cancel-order-btn\" data-order-id=\"" + order.id + "\">Cancel Order</button>"
      : "";

    const cancelledNote = isCancelled
      ? "<div class=\"cancelled-note\">" +
        "  <span class=\"status-badge status-cancelled\"><i class=\"fa-solid fa-ban\"></i> Cancelled</span>" +
        "  <p>Cancelled on " + formatDateTime(order.cancelled_at) + "</p>" +
        (order.cancellation_reason ? "  <p>Reason: " + order.cancellation_reason + "</p>" : "") +
        (order.refund_status === "refund_initiated" ? "  <p class=\"cod-note\"><i class=\"fa-solid fa-rotate-left\"></i> Refund Initiated</p>" : "") +
        (order.refund_status === "refunded" ? "  <p class=\"cod-note\"><i class=\"fa-solid fa-circle-check\"></i> Refunded</p>" : "") +
        "</div>"
      : "";

    const headerBadge = isCancelled
      ? "<span class=\"status-badge status-cancelled\">Cancelled</span>"
      : "<span class=\"status-badge status-" + (order.tracking_step === 4 ? "delivered" : "processing") +"\">" + order.tracking_label + "</span>";

    html +=
      "<div class=\"order-card\">" +
      "  <div class=\"order-card-header\">" +
      "    <div>" +
      "      <h2>Order #" + order.id + "</h2>" +
      "      <p class=\"order-card-date\">Placed on " + formatDate(order.created_at) + "</p>" +
      "    </div>" +
           headerBadge +
      "  </div>" +

      buildTrackingBarHtml(order) +

      "  <div class=\"order-items-list\">" + itemsHtml + "</div>" +

      "  <div class=\"order-card-meta\">" +
      "    <div><strong>Delivery Address</strong><p>" + order.delivery_address + "</p></div>" +
      "    <div><strong>Estimated Delivery</strong><p>" + formatDate(order.estimated_delivery) + "</p></div>" +
      "    <div><strong>Payment Method</strong><p>" + order.payment_method_display + "</p></div>" +
      "    <div><strong>Payment Status</strong><p><span class=\"status-badge payment-" + order.payment_status + "\">" + PAYMENT_STATUS_LABELS[order.payment_status] + "</span></p></div>" +
      "  </div>" +

      codCollectedNote +
      cancelledNote +

      "  <div class=\"order-card-footer\">" +
      "    <span class=\"order-card-total\">Total: \u20B9" + Number(order.total).toLocaleString("en-IN") + "</span>" +
           receiptBtn + payNowBtn + cancelBtn +
      "  </div>" +
      "</div>";
  });

  ordersContainer.innerHTML = html;

  document.querySelectorAll(".view-receipt-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const order = orders.find(function (o) { return String(o.id) === btn.dataset.orderId; });
      if (order) {
        showReceipt(order);
      }
    });
  });

  document.querySelectorAll(".cancel-order-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      cancelOrder(btn.dataset.orderId, btn);
    });
  });
}

async function cancelOrder(orderId, btn) {
  const confirmed = window.confirm("Are you sure you want to cancel this order? This cannot be undone.");
  if (!confirmed) {
    return;
  }

  btn.disabled = true;
  btn.textContent = "Cancelling...";

  try {
    const response = await authFetch(API_URL + "/orders/" + orderId + "/cancel/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "" }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to cancel order.");
    }

    // Reload the whole list so this card immediately flips to the
    // Cancelled state everywhere it appears.
    loadOrders();
  } catch (error) {
    console.error("Could not cancel order:", error);
    alert(error.message);
    btn.disabled = false;
    btn.textContent = "Cancel Order";
  }
}

function showReceipt(order) {
  const existing = document.querySelector(".receipt-modal-overlay");
  if (existing) {
    document.body.removeChild(existing);
  }

  const modal = document.createElement("div");
  modal.className = "receipt-modal-overlay";
  modal.innerHTML =
    "<div class=\"receipt-modal\">" +
    "  <button class=\"receipt-close-btn\">&times;</button>" +
    "  <div id=\"receiptPrintArea\">" +
    "    <h2>Payment Receipt</h2>" +
    "    <hr>" +
    "    <p><strong>Order ID:</strong> #" + order.id + "</p>" +
    "    <p><strong>Transaction ID:</strong> " + order.transaction_id + "</p>" +
    "    <p><strong>Payment Date &amp; Time:</strong> " + formatDateTime(order.payment_date) + "</p>" +
    "    <p><strong>Payment Method:</strong> " + order.payment_method_display + "</p>" +
    "    <p><strong>Amount Paid:</strong> \u20B9" + Number(order.total).toLocaleString("en-IN") + "</p>" +
    "    <hr>" +
    "    <p style=\"font-size:0.8rem; color:#777;\">Thank you for shopping with Shopzon.</p>" +
    "  </div>" +
    "  <button class=\"auth-submit\" id=\"receiptPrintBtn\">Print / Save as PDF</button>" +
    "</div>";

  document.body.appendChild(modal);

  modal.querySelector(".receipt-close-btn").addEventListener("click", function () {
    document.body.removeChild(modal);
  });
  modal.addEventListener("click", function (event) {
    if (event.target === modal) {
      document.body.removeChild(modal);
    }
  });
  modal.querySelector("#receiptPrintBtn").addEventListener("click", function () {
    window.print();
  });
}

loadOrders();
