// checkout.js
//
// Runs only on checkout.html. Two steps:
//   1. Address -- pick a saved address, or add a new one (saved via
//      POST /api/auth/addresses/ for reuse next time).
//   2. Payment method -- visual cards, COD or Online.
// Place Order creates the order via POST /api/orders/, same as before.
// COD goes straight to orders.html; Online redirects to payment.html.

let selectedAddress = null;
let appliedCoupon = null; // { code, discount_amount, new_total }

function renderCheckoutSummary() {
  const cart = getCart();
  const itemsContainer = document.getElementById('checkoutItems');

  if (cart.length === 0) {
    window.location.href = 'cart.html';
    return;
  }

  let html = '';
  cart.forEach(function (item) {
    const product = findProductById(item.id);
    if (!product) {
      return;
    }
    html +=
      '<div class="cart-row">' +
      '  <div class="cart-row-image" style="background-image: url(\'' + product.image + '\');"></div>' +
      '  <div class="cart-row-info">' +
      '    <h3>' + product.title + '</h3>' +
      '    <p>Qty: ' + item.qty + ' \u00d7 \u20B9' + product.price.toLocaleString('en-IN') + '</p>' +
      '  </div>' +
      '  <div class="cart-row-total">\u20B9' + (product.price * item.qty).toLocaleString('en-IN') + '</div>' +
      '</div>';
  });

  itemsContainer.innerHTML = html;
  updateCheckoutTotals();
}

function updateCheckoutTotals() {
  const subtotal = getCartTotal();
  document.getElementById('checkoutSubtotal').textContent = 'Subtotal: Rs.' + subtotal.toLocaleString('en-IN');

  const discountLine = document.getElementById('checkoutDiscount');
  const totalLine = document.getElementById('checkoutTotal');

  if (appliedCoupon) {
    discountLine.style.display = 'block';
    discountLine.textContent = 'Discount (' + appliedCoupon.code + '): -Rs.' + appliedCoupon.discount_amount.toLocaleString('en-IN');
    totalLine.textContent = 'Total: Rs.' + appliedCoupon.new_total.toLocaleString('en-IN');
  } else {
    discountLine.style.display = 'none';
    totalLine.textContent = 'Total: Rs.' + subtotal.toLocaleString('en-IN');
  }
}

document.getElementById('applyCouponBtn').addEventListener('click', async function () {
  const codeInput = document.getElementById('couponInput');
  const messageEl = document.getElementById('couponMessage');
  const code = codeInput.value.trim();

  if (!code) {
    messageEl.textContent = 'Please enter a coupon code.';
    messageEl.className = 'coupon-message coupon-error';
    return;
  }

  const subtotal = getCartTotal();
  messageEl.textContent = 'Checking...';
  messageEl.className = 'coupon-message';

  try {
    const response = await fetch(API_URL + '/orders/apply-coupon/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getAccessToken(),
      },
      body: JSON.stringify({ code: code, order_total: subtotal }),
    });

    const data = await response.json();

    if (!response.ok) {
      appliedCoupon = null;
      messageEl.textContent = data.error || 'Invalid coupon.';
      messageEl.className = 'coupon-message coupon-error';
      updateCheckoutTotals();
      return;
    }

    appliedCoupon = data;
    messageEl.textContent = 'Coupon applied! You saved Rs.' + data.discount_amount.toLocaleString('en-IN') + '.';
    messageEl.className = 'coupon-message coupon-success';
    updateCheckoutTotals();
  } catch (error) {
    messageEl.textContent = 'Something went wrong. Please try again.';
    messageEl.className = 'coupon-message coupon-error';
  }
});

// ---------- SAVED ADDRESSES ----------

async function loadSavedAddresses() {
  const container = document.getElementById('savedAddressList');
  try {
    const response = await fetch(API_URL + '/auth/addresses/', {
      headers: { 'Authorization': 'Bearer ' + getAccessToken() },
    });
    if (!response.ok) {
      throw new Error('Failed to load addresses: ' + response.status);
    }
    const addresses = await response.json();
    renderSavedAddresses(addresses);
  } catch (error) {
    console.error('Could not load saved addresses:', error);
    container.innerHTML = '';
  }
}

function renderSavedAddresses(addresses) {
  const container = document.getElementById('savedAddressList');

  if (addresses.length === 0) {
    container.innerHTML = '';
    document.getElementById('newAddressForm').style.display = 'block';
    return;
  }

  let html = '';
  addresses.forEach(function (addr) {
    html +=
      '<label class="saved-address-card">' +
      '  <input type="radio" name="savedAddress" value="' + addr.id + '"' + (addr.is_default ? ' checked' : '') + '>' +
      '  <div>' +
      '    <strong>' + addr.full_name + '</strong>' + (addr.is_default ? ' <span class="default-badge">Default</span>' : '') +
      '    <p>' + addr.address_line + ', ' + addr.city + ', ' + addr.state + ' - ' + addr.pincode + '</p>' +
      '    <p>Mobile: ' + addr.mobile + '</p>' +
      '  </div>' +
      '</label>';
  });
  container.innerHTML = html;

  const defaultAddr = addresses.find(function (a) { return a.is_default; }) || addresses[0];
  selectedAddress = defaultAddr;

  document.querySelectorAll('input[name="savedAddress"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      selectedAddress = addresses.find(function (a) { return String(a.id) === radio.value; });
    });
  });
}

document.getElementById('addNewAddressBtn').addEventListener('click', function () {
  const form = document.getElementById('newAddressForm');
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('saveAddressBtn').addEventListener('click', async function () {
  const fullName = document.getElementById('fullName').value.trim();
  const mobile = document.getElementById('mobile').value.trim();
  const email = document.getElementById('emailAddr').value.trim();
  const addressLine = document.getElementById('addressLine').value.trim();
  const city = document.getElementById('city').value.trim();
  const stateVal = document.getElementById('stateField').value.trim();
  const pincode = document.getElementById('pincode').value.trim();
  const isDefault = document.getElementById('setDefaultAddress').checked;
  const errorBox = document.getElementById('addressError');
  const btn = document.getElementById('saveAddressBtn');

  if (!fullName || !mobile || !addressLine || !city || !stateVal || !pincode) {
    errorBox.textContent = 'Please fill in all required fields.';
    return;
  }

  errorBox.textContent = '';
  btn.textContent = 'Saving...';
  btn.disabled = true;

  try {
    const response = await fetch(API_URL + '/auth/addresses/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getAccessToken(),
      },
      body: JSON.stringify({
        full_name: fullName,
        mobile: mobile,
        email: email,
        address_line: addressLine,
        city: city,
        state: stateVal,
        pincode: pincode,
        is_default: isDefault,
      }),
    });

    if (!response.ok) {
      throw new Error('Save failed: ' + response.status);
    }

    const newAddress = await response.json();
    selectedAddress = newAddress;
    document.getElementById('newAddressForm').style.display = 'none';
    await loadSavedAddresses();
  } catch (error) {
    console.error('Could not save address:', error);
    errorBox.textContent = 'Something went wrong saving this address. Please try again.';
  } finally {
    btn.textContent = 'Save Address';
    btn.disabled = false;
  }
});

// ---------- STEP NAVIGATION ----------

document.getElementById('toPaymentBtn').addEventListener('click', function () {
  const errorBox = document.getElementById('stepAddressError');

  if (!selectedAddress) {
    errorBox.textContent = 'Please select or add a delivery address.';
    return;
  }
  errorBox.textContent = '';

  document.getElementById('stepAddress').style.display = 'none';
  document.getElementById('stepPayment').style.display = 'block';
  document.querySelector('.checkout-step[data-step="1"]').classList.remove('active');
  document.querySelector('.checkout-step[data-step="1"]').classList.add('completed');
  document.querySelector('.checkout-step[data-step="2"]').classList.add('active');
});

document.getElementById('backToAddressBtn').addEventListener('click', function () {
  document.getElementById('stepPayment').style.display = 'none';
  document.getElementById('stepAddress').style.display = 'block';
  document.querySelector('.checkout-step[data-step="2"]').classList.remove('active');
  document.querySelector('.checkout-step[data-step="1"]').classList.add('active');
});

// ---------- PLACE ORDER ----------

async function placeOrder() {
  if (!requireLogin()) {
    return;
  }
  if (!selectedAddress) {
    document.getElementById('checkoutError').textContent = 'Please go back and select a delivery address.';
    return;
  }

  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
  const cart = getCart();
  const errorBox = document.getElementById('checkoutError');
  const placeOrderBtn = document.getElementById('placeOrderBtn');

  if (cart.length === 0) {
    window.location.href = 'cart.html';
    return;
  }

  const fullDeliveryAddress =
    selectedAddress.full_name + ', ' + selectedAddress.address_line + ', ' +
    selectedAddress.city + ', ' + selectedAddress.state + ' - ' + selectedAddress.pincode +
    ' (Mobile: ' + selectedAddress.mobile + ')';

  errorBox.textContent = '';
  placeOrderBtn.textContent = 'Placing order...';
  placeOrderBtn.disabled = true;

  try {
    const response = await fetch(API_URL + '/orders/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getAccessToken(),
      },
      body: JSON.stringify({
        items: cart.map(function (item) {
          return { product_id: Number(item.id), quantity: item.qty };
        }),
        delivery_address: fullDeliveryAddress,
        payment_method: paymentMethod,
        coupon_code: appliedCoupon ? appliedCoupon.code : '',
      }),
    });

    if (response.status === 401) {
      window.location.href = 'login.html';
      return;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(function () { return {}; });
      const stockErrors = errorData.stock_error;
      if (stockErrors && stockErrors.length > 0) {
        throw new Error(stockErrors.join(' '));
      }
      throw new Error('Order creation failed: ' + response.status);
    }

    const order = await response.json();

    if (paymentMethod === 'cod') {
      saveCart([]);
      updateCartBadge();
      window.location.href = 'orders.html';
    } else {
      window.location.href = 'payment.html?order_id=' + order.id;
    }
  } catch (error) {
    console.error('Checkout error:', error);
    errorBox.textContent = error.message || 'Something went wrong placing your order. Please try again.';
    placeOrderBtn.textContent = 'Place Order';
    placeOrderBtn.disabled = false;
  }
}

document.getElementById('placeOrderBtn').addEventListener('click', placeOrder);

productsReady.then(renderCheckoutSummary);
loadSavedAddresses();

// ---------- PAYMENT SUB-FORM (card / UPI / netbanking details) ----------
// Purely a visual/UX step -- this is a simulated gateway, so these
// details are never actually sent to our backend or anywhere else.
// A real integration would collect this inside the payment gateway's
// own hosted iframe (Razorpay/Stripe), never touching our server at all.

function renderPaymentSubform(cardLabel) {
  const container = document.getElementById("paymentSubform");

  if (cardLabel === "Cash on Delivery") {
    container.innerHTML =
      "<p class=\"cod-note\"><i class=\"fa-solid fa-circle-info\"></i> Pay in cash to the delivery agent when your order arrives.</p>";
    return;
  }

  if (cardLabel === "Card") {
    container.innerHTML =
      "<label>Card Number</label>" +
      "<input type=\"text\" placeholder=\"1234 5678 9012 3456\" maxlength=\"19\" id=\"cardNumber\">" +
      "<div class=\"card-subform-row\">" +
      "  <div><label>Expiry</label><input type=\"text\" placeholder=\"MM/YY\" maxlength=\"5\" id=\"cardExpiry\"></div>" +
      "  <div><label>CVV</label><input type=\"password\" placeholder=\"123\" maxlength=\"3\" id=\"cardCvv\"></div>" +
      "</div>" +
      "<label>Name on Card</label>" +
      "<input type=\"text\" placeholder=\"As shown on card\" id=\"cardName\">";
    return;
  }

  if (cardLabel === "UPI") {
    container.innerHTML =
      "<label>UPI ID</label>" +
      "<input type=\"text\" placeholder=\"yourname@upi\" id=\"upiId\">";
    return;
  }

  if (cardLabel === "Netbanking") {
    container.innerHTML =
      "<label>Select Bank</label>" +
      "<select id=\"bankSelect\">" +
      "  <option value=\"\">Choose your bank</option>" +
      "  <option value=\"sbi\">State Bank of India</option>" +
      "  <option value=\"hdfc\">HDFC Bank</option>" +
      "  <option value=\"icici\">ICICI Bank</option>" +
      "  <option value=\"axis\">Axis Bank</option>" +
      "  <option value=\"other\">Other</option>" +
      "</select>";
    return;
  }

  container.innerHTML = "";
}

document.querySelectorAll(".payment-method-card").forEach(function (card) {
  const radio = card.querySelector("input[type=\"radio\"]");
  const label = card.querySelector("strong").textContent.trim();

  card.addEventListener("click", function () {
    renderPaymentSubform(label);
  });

  if (radio.checked) {
    renderPaymentSubform(label);
  }
});