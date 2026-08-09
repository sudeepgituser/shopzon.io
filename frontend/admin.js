// admin.js
//
// Runs only on admin.html. Only the site owner (Django is_staff flag)
// can actually see data here. Admin can edit the delivery address,
// collect cash for COD orders, send notifications, and see cancelled
// orders (read-only -- cancelled orders cannot be edited here).
// All authenticated requests go through authFetch() (auth.js), which
// auto-refreshes an expired access token and retries once on 401.

const adminOrdersContainer = document.getElementById("adminOrdersContainer");

async function loadAdminOrders() {
  if (!requireLogin()) {
    return;
  }

  if (!isAdminUser()) {
    adminOrdersContainer.innerHTML = "<p>You do not have permission to view this page.</p>";
    return;
  }

  try {
    const response = await authFetch(API_BASE + "/orders/admin/", {});

    if (response.status === 403) {
      adminOrdersContainer.innerHTML = "<p>You do not have permission to view this page.</p>";
      return;
    }

    if (!response.ok) {
      throw new Error("Failed to load admin orders: " + response.status);
    }

    const orders = await response.json();
    renderAdminOrders(orders);
  } catch (error) {
    console.error("Could not load admin orders:", error);
    adminOrdersContainer.innerHTML = "<p>Something went wrong loading orders. Please try again.</p>";
  }
}

function formatDateTime(dateStr) {
  if (!dateStr) {
    return "\u2014";
  }
  return new Date(dateStr).toLocaleString("en-IN", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

function renderAdminOrders(orders) {
  if (orders.length === 0) {
    adminOrdersContainer.innerHTML = "<p>No orders have been placed yet.</p>";
    return;
  }

  let html = "";

  orders.forEach(function (order) {
    const date = new Date(order.created_at).toLocaleDateString("en-IN", {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
    });

    let itemsHtml = "";
    order.items.forEach(function (item) {
      itemsHtml +=
        "<div class=\"order-item-row\">" +
        "  <div class=\"order-item-image\" style=\"background-image: url(\'" + item.image + "\');\"></div>" +
        "  <div class=\"order-item-info\">" +
        "    <h3>" + item.title + "</h3>" +
        "    <p>Qty: " + item.quantity + " x Rs." + Number(item.price).toLocaleString("en-IN") + "</p>" +
        "  </div>" +
        "  <div class=\"order-item-total\">Rs." + (item.price * item.quantity).toLocaleString("en-IN") + "</div>" +
        "</div>";
    });

    const isCancelled = order.order_status === "cancelled";
    const orderStatusLabel = isCancelled ? "Cancelled" : (order.order_status.charAt(0).toUpperCase() + order.order_status.slice(1));
    const paymentStatusLabel = order.payment_status_display;

    const collectCashBtn = (order.payment_method === "cod" && order.payment_status === "pending" && !isCancelled)
      ? "<button class=\"collect-cash-btn\" data-order-id=\"" + order.id + "\">Collect Cash</button>"
      : "";

    const collectedNote = (order.payment_status === "cash_collected" && !isCancelled)
      ? "<p class=\"cod-note\"><i class=\"fa-solid fa-circle-check\"></i> Cash collected by " +
        (order.collected_by_username || "admin") + " on " + formatDateTime(order.collected_at) + "</p>"
      : "";

    const cancelledNote = isCancelled
      ? "<div class=\"cancelled-note\">" +
        "  <p><i class=\"fa-solid fa-ban\"></i> Cancelled by " + (order.cancelled_by_username || "customer") + " on " + formatDateTime(order.cancelled_at) + "</p>" +
        (order.cancellation_reason ? "  <p>Reason: " + order.cancellation_reason + "</p>" : "") +
        (order.refund_status === "refund_initiated" ? "  <p class=\"cod-note\"><i class=\"fa-solid fa-rotate-left\"></i> Refund Initiated</p>" : "") +
        (order.refund_status === "refunded" ? "  <p class=\"cod-note\"><i class=\"fa-solid fa-circle-check\"></i> Refunded</p>" : "") +
        "</div>"
      : "";

    // Cancelled orders are read-only: no Save Changes, no Collect Cash.
    const saveBtn = isCancelled
      ? ""
      : "<button class=\"admin-save-btn\" data-order-id=\"" + order.id + "\">Save Changes</button>";

    const addressField = isCancelled
      ? "<p>" + (order.delivery_address || "") + "</p>"
      : "<textarea class=\"admin-address-input\" rows=\"2\">" + (order.delivery_address || "") + "</textarea>";

    const flaggedBanner = order.is_flagged
      ? "<div class=\"risk-flag-banner\"><i class=\"fa-solid fa-triangle-exclamation\"></i> <strong>Flagged for review:</strong> " + order.risk_reasons + "</div>"
      : "";

    html +=
      "<div class=\"order-card" + (order.is_flagged ? " order-card-flagged" : "") + "\" data-order-id=\"" + order.id + "\">" +
      flaggedBanner +
      "  <div class=\"order-card-header\">" +
      "    <div>" +
      "      <h2>Order #" + order.id + "</h2>" +
      "      <p class=\"order-card-date\">" + date + " -- Customer: <strong>" + order.username + "</strong>" + (order.email ? " (" + order.email + ")": "") + "</p>" +
      "    </div>" +
      "    <span class=\"status-badge status-" + order.order_status + "\">" + orderStatusLabel + "</span>" +
      "  </div>" +
      "  <div class=\"order-items-list\">" + itemsHtml + "</div>" +
      "  <div class=\"order-card-meta admin-edit-grid\">" +
      "    <div>" +
      "      <strong>Delivery Address</strong>" +
           addressField +
      "    </div>" +
      "    <div>" +
      "      <strong>Estimated Delivery</strong>" +
      "      <p>" + (order.estimated_delivery ? new Date(order.estimated_delivery).toLocaleDateString("en-IN", { year: "numeric", month: "short", day:"numeric" }) : "--") + "</p>" +
      "    </div>" +
      "    <div>" +
      "      <strong>Order Status</strong>" +
      "      <p><span class=\"status-badge status-" + order.order_status + "\">" + orderStatusLabel + "</span></p>" +
      "    </div>" +
      "    <div>" +
      "      <strong>Payment Status</strong>" +
      "      <p><span class=\"status-badge payment-" + order.payment_status + "\">" + paymentStatusLabel + "</span></p>" +
      "    </div>" +
      "  </div>" +
      collectedNote +
      cancelledNote +
      "  <div class=\"order-card-footer\">" +
      "    <span class=\"order-card-total\">Total: Rs." + Number(order.total).toLocaleString("en-IN") + "</span>" +
           saveBtn +
      "    <button class=\"notify-customer-btn\" data-order-id=\"" + order.id + "\">Notify Customer</button>" +
      "    <button class=\"notify-whatsapp-btn\" data-order-id=\"" + order.id + "\">Notify via WhatsApp (Demo)</button>" +
           collectCashBtn +
      "  </div>" +
      "  <p class=\"admin-save-status\"></p>" +
      "  <p class=\"notify-status\" data-order-id=\"" + order.id + "\"></p>" +
      "  <p class=\"collect-cash-status\" data-order-id=\"" + order.id + "\"></p>" +
      "</div>";
  });

  adminOrdersContainer.innerHTML = html;

  document.querySelectorAll(".admin-save-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      saveAdminOrderChanges(btn.dataset.orderId, btn);
    });
  });

  document.querySelectorAll(".notify-customer-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      notifyCustomer(btn.dataset.orderId, btn);
    });
  });

  document.querySelectorAll(".notify-whatsapp-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      notifyWhatsApp(btn.dataset.orderId, btn);
    });
  });

  document.querySelectorAll(".collect-cash-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      collectCash(btn.dataset.orderId, btn);
    });
  });
}

async function saveAdminOrderChanges(orderId, btn) {
  const card = document.querySelector(".order-card[data-order-id=\"" + orderId + "\"]");
  const address = card.querySelector(".admin-address-input").value.trim();
  const statusMsg = card.querySelector(".admin-save-status");

  btn.disabled = true;
  btn.textContent = "Saving...";
  statusMsg.textContent = "";

  try {
    const response = await authFetch(API_BASE + "/orders/admin/" + orderId + "/update/", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delivery_address: address }),
    });

    if (!response.ok) {
      throw new Error("Update failed: " + response.status);
    }

    statusMsg.textContent = "Saved!";
    statusMsg.style.color = "#1a7a1a";
  } catch (error) {
    console.error("Could not save order changes:", error);
    statusMsg.textContent = "Failed to save. Please try again.";
    statusMsg.style.color = "#b3261e";
  } finally {
    btn.disabled = false;
    btn.textContent = "Save Changes";
    setTimeout(function () {
      statusMsg.textContent = "";
    }, 3000);
  }
}

async function notifyCustomer(orderId, btn) {
  const statusMsg = document.querySelector('.notify-status[data-order-id="' + orderId + '"]');
  btn.disabled = true;
  btn.textContent = 'Sending...';
  statusMsg.textContent = '';

  try {
    const response = await authFetch(API_BASE + '/orders/admin/' + orderId + '/notify/', {
      method: 'POST',
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to send notification.');
    }

    statusMsg.textContent = data.message || 'Notified!';
    statusMsg.style.color = '#1a7a1a';
  } catch (error) {
    console.error('Notify error:', error);
    statusMsg.textContent = error.message;
    statusMsg.style.color = '#b3261e';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Notify Customer';
    setTimeout(function () {
      statusMsg.textContent = '';
    }, 5000);
  }
}

async function notifyWhatsApp(orderId, btn) {
  const statusMsg = document.querySelector('.notify-status[data-order-id="' + orderId + '"]');
  btn.disabled = true;
  btn.textContent = 'Sending...';

  try {
    const response = await authFetch(API_BASE + '/orders/admin/' + orderId + '/notify-whatsapp/', {
      method: 'POST',
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to send.');
    }

    statusMsg.textContent = data.message;
    statusMsg.style.color = '#0b5fb0';
  } catch (error) {
    statusMsg.textContent = error.message;
    statusMsg.style.color = '#b3261e';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Notify via WhatsApp (Demo)';
    setTimeout(function () { statusMsg.textContent = ''; }, 5000);
  }
}

async function collectCash(orderId, btn) {
  const statusMsg = document.querySelector('.collect-cash-status[data-order-id="' + orderId + '"]');
  btn.disabled = true;
  btn.textContent = 'Collecting...';
  statusMsg.textContent = '';

  try {
    const response = await authFetch(API_BASE + '/orders/admin/' + orderId + '/collect-cash/', {
      method: 'POST',
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to collect cash.');
    }

    loadAdminOrders();
  } catch (error) {
    console.error('Collect cash error:', error);
    statusMsg.textContent = error.message;
    statusMsg.style.color = '#b3261e';
    btn.disabled = false;
    btn.textContent = 'Collect Cash';
  }
}

loadAdminOrders();
