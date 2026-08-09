// cart.js
//
// Shared cart logic. Loaded on every page (index, product, cart) so the
// cart stays consistent no matter which page you're on.
//
// The cart is just an array of { id, qty } saved in localStorage, keyed
// per logged-in user (so switching accounts on the same browser doesn't
// show the previous person's cart). Guests (not logged in) share a
// single "guest" cart. We store only the id and quantity here, then
// look up the title/price/image from products.js whenever we need to
// display something. This avoids keeping product details in two places.
//
// NOTE: localStorage only lasts in this one browser. Once carts move to
// the Django backend, this can be replaced by a database table tied to
// the logged-in user instead.

function getCartStorageKey() {
  // getLoggedInUser() comes from auth.js, which loads before this
  // function is ever called (auth.js runs on page load; addToCart etc.
  // only run later, in response to user clicks).
  const user = (typeof getLoggedInUser === 'function') ? getLoggedInUser() : null;
  return user ? 'cart_' + user : 'cart_guest';
}

function getCart() {
  const raw = localStorage.getItem(getCartStorageKey());
  if (!raw) {
    return [];
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error('Could not read cart from storage:', error);
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(getCartStorageKey(), JSON.stringify(cart));
}

// Adds one unit of a product to the cart. If it's already in the cart,
// just increases the quantity instead of adding a duplicate row.
// Product IDs are normalized to strings here so an id coming from a
// data-attribute (always a string) and an id coming from the API
// (a number) are never treated as two different products.
function addToCart(productId, quantity) {
  quantity = quantity || 1;
  productId = String(productId);

  const cart = getCart();
  const existingItem = cart.find(function (item) {
    return String(item.id) === productId;
  });

  if (existingItem) {
    existingItem.qty += quantity;
  } else {
    cart.push({ id: productId, qty: quantity });
  }

  saveCart(cart);
  updateCartBadge();
}

function removeFromCart(productId) {
  productId = String(productId);
  let cart = getCart();
  cart = cart.filter(function (item) {
    return String(item.id) !== productId;
  });
  saveCart(cart);
  updateCartBadge();
}

function setQuantity(productId, quantity) {
  productId = String(productId);
  const cart = getCart();
  const item = cart.find(function (item) {
    return String(item.id) === productId;
  });
  if (item) {
    item.qty = quantity;
    if (item.qty <= 0) {
      removeFromCart(productId);
      return;
    }
  }
  saveCart(cart);
  updateCartBadge();
}

// Total number of items in the cart (adds up quantities, not just rows).
function getCartItemCount() {
  const cart = getCart();
  return cart.reduce(function (total, item) {
    return total + item.qty;
  }, 0);
}

// Total price of everything in the cart. Needs PRODUCTS from products.js
// to look up each item's price.
function getCartTotal() {
  const cart = getCart();
  let total = 0;
  cart.forEach(function (item) {
    const product = findProductById(item.id);
    if (product) {
      total += product.price * item.qty;
    }
  });
  return total;
}

// Updates the little number badge next to the cart icon in the navbar.
// Safe to call on every page even if the badge element doesn't exist there.
function updateCartBadge() {
  const badge = document.getElementById('cartCount');
  if (badge) {
    badge.textContent = getCartItemCount();
  }
}

// Run on every page load so the badge is correct as soon as the page opens.
document.addEventListener('DOMContentLoaded', updateCartBadge);