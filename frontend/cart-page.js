// cart-page.js
//
// Runs only on cart.html. Reads the cart from localStorage (via the
// functions in cart.js) and draws the item list + total. Checkout now
// sends the cart to Django to create a real Order, using the JWT
// access token to identify the logged-in user.
function renderCartPage() {
  const cart = getCart();
  const itemsContainer = document.getElementById('cartItems');
  const summary = document.getElementById('cartSummary');
  if (cart.length === 0) {
    itemsContainer.innerHTML = '<p>Your cart is empty. <a href="index.html">Start shopping</a>.</p>';
    summary.style.display = 'none';
    return;
  }
  let rowsHtml = '';
  cart.forEach(function (item) {
    const product = findProductById(item.id);
    if (!product) {
      return;
    }
    const lineTotal = (product.price * item.qty).toLocaleString('en-IN');
    rowsHtml +=
      '<div class="cart-row" data-id="' + product.id + '">' +
      '  <div class="cart-row-image" style="background-image: url(\'' + product.image + '\');"></div>' +
      '  <div class="cart-row-info">' +
      '    <h3>' + product.title + '</h3>' +
      '    <p class="cart-row-price">\u20B9' + product.price.toLocaleString('en-IN') + ' each</p>' +
      '    <p class="cart-row-stock' + (product.stockQuantity > 0 ? '' : ' cart-row-out-of-stock') + '"><i class="fa-solid fa-' + (product.stockQuantity > 0 ? 'circle-check' : 'circle-xmark') + '"></i> ' + (product.stockQuantity > 0 ? 'In Stock' : 'Out of Stock') + '</p>' +
      '    <div class="cart-qty-stepper">' +
      '      <button type="button" class="qty-step-btn qty-minus" data-id="' + product.id + '">\u2212</button>' +
      '      <input type="number" min="1" value="' + item.qty + '" class="cart-qty-input" data-id="' + product.id + '">' +
      '      <button type="button" class="qty-step-btn qty-plus" data-id="' + product.id + '">+</button>' +
      '    </div>' +
      '    <div class="cart-row-links">' +
      '      <button class="cart-remove-btn" data-id="' + product.id + '">Delete</button>' +
      '      <span class="cart-row-divider">|</span>' +
      '      <a href="#" class="cart-save-link">Save for later</a>' +
      '    </div>' +
      '  </div>' +
      '  <div class="cart-row-total">\u20B9' + lineTotal + '</div>' +
      '</div>';
  });
  itemsContainer.innerHTML = rowsHtml;
  summary.style.display = 'block';
  document.getElementById('cartTotal').textContent = '\u20B9' + getCartTotal().toLocaleString('en-IN');

  document.querySelectorAll('.cart-qty-input').forEach(function (input) {
    input.addEventListener('change', function () {
      const id = Number(input.dataset.id);
      const newQty = Number(input.value);
      setQuantity(id, newQty);
      renderCartPage();
    });
  });
  document.querySelectorAll('.qty-plus').forEach(function (button) {
    button.addEventListener('click', function () {
      const id = Number(button.dataset.id);
      const item = getCart().find(function (i) { return String(i.id) === String(id); });
      const product = findProductById(id);
      if (product && item.qty >= product.stockQuantity) {
        return;
      }
      setQuantity(id, item.qty + 1);
      renderCartPage();
    });
  });
  document.querySelectorAll('.qty-minus').forEach(function (button) {
    button.addEventListener('click', function () {
      const id = Number(button.dataset.id);
      const item = getCart().find(function (i) { return String(i.id) === String(id); });
      setQuantity(id, item.qty - 1);
      renderCartPage();
    });
  });
  document.querySelectorAll('.cart-remove-btn').forEach(function (button) {
    button.addEventListener('click', function () {
      const id = Number(button.dataset.id);
      removeFromCart(id);
      renderCartPage();
    });
  });
  // "Save for later" is visual only for now — no separate saved-list feature yet
  document.querySelectorAll('.cart-save-link').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
    });
  });
}
function handleCheckout() {
  if (!requireLogin()) {
    return;
  }
  const cart = getCart();
  if (cart.length === 0) {
    return;
  }

  const outOfStockItems = [];
  cart.forEach(function (item) {
    const product = findProductById(item.id);
    if (product && product.stockQuantity <= 0) {
      outOfStockItems.push(product.title);
    } else if (product && item.qty > product.stockQuantity) {
      outOfStockItems.push(product.title + ' (only ' + product.stockQuantity + ' left)');
    }
  });

  if (outOfStockItems.length > 0) {
    alert(
      'Some items in your cart are out of stock or exceed available quantity:\n\n' +
      outOfStockItems.join('\n') +
      '\n\nPlease update your cart before checking out.'
    );
    return;
  }

  window.location.href = 'checkout.html';
}
const checkoutBtnEl = document.getElementById('checkoutBtn');
if (checkoutBtnEl) {
  checkoutBtnEl.addEventListener('click', handleCheckout);
}
productsReady.then(renderCartPage);