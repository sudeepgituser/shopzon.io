// product.js
//
// Runs only on product.html. Reads the product id from the URL
// (e.g. product.html?id=3), looks it up in PRODUCTS (from products.js),
// and builds the page content.
function getProductIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const idText = params.get('id');
  return idText ? Number(idText) : null;
}

function renderProductPage(products) {
  const container = document.getElementById('productPage');
  const productId = getProductIdFromUrl();
  const product = productId ? findProductById(productId) : null;

  if (!product) {
    container.innerHTML = '<p>Sorry, we could not find that product. <a href="index.html">Go back home</a>.</p>';
    return;
  }

  const stock = Number(product.stockQuantity);
  const inStock = stock > 0;

  const stockHtml = inStock
    ? '<p class="buy-box-stock"><i class="fa-solid fa-circle-check"></i> In Stock' + (stock <= 5 ? ' (only ' + stock + ' left)' : '') + '</p>'
    : '<p class="buy-box-stock buy-box-out-of-stock"><i class="fa-solid fa-circle-xmark"></i> Out of Stock</p>';

  const qtyOptions = [];
  const maxQty = Math.min(stock, 5);
  for (let i = 1; i <= maxQty; i++) {
    qtyOptions.push('<option value="' + i + '">' + i + '</option>');
  }

  container.innerHTML =
    '<div class="product-gallery">' +
    '  <div class="product-image" style="background-image: url(\'' + product.image + '\');"></div>' +
    '</div>' +
    '<div class="product-info">' +
    '  <h1>' + product.title + '</h1>' +
    '  <p class="product-price">\u20B9' + product.price.toLocaleString('en-IN') + '</p>' +
    '  <div class="product-description-box">' +
    '    <h2 class="product-description-heading">About this item</h2>' +
    '    <p class="product-description">' + product.description + '</p>' +
    '  </div>' +
    '</div>' +
    '<div class="buy-box">' +
    '  <p class="buy-box-price">\u20B9' + product.price.toLocaleString('en-IN') + '</p>' +
    stockHtml +
    '  <p class="buy-box-delivery">Free delivery available</p>' +
    '  <label for="productQty">Quantity</label>' +
    '  <select id="productQty"' + (inStock ? '' : ' disabled') + '>' +
    (inStock ? qtyOptions.join('') : '<option value="0">0</option>') +
    '  </select>' +
    '  <button id="addToCartBtn" class="auth-submit buy-box-btn"' + (inStock ? '' : ' disabled') + '>' +
    (inStock ? 'Add to Cart' : 'Out of Stock') +
    '  </button>' +
    '</div>';

  if (inStock) {
    document.getElementById('addToCartBtn').addEventListener('click', function () {
      const qty = Number(document.getElementById('productQty').value);
      addToCart(product.id, qty);
      alert(qty + ' x "' + product.title + '" added to your cart.');
    });
  }

  renderReviewSection(product.id);
}

// ---------- REVIEWS ----------

let selectedStarRating = 0;

async function renderReviewSection(productId) {
  const container = document.getElementById('productPage');

  const reviewSectionHtml =
    '<div class="reviews-section">' +
    '  <h2 class="reviews-heading">Customer Reviews</h2>' +
    '  <div id="reviewFormContainer"></div>' +
    '  <div id="reviewsList"><p>Loading reviews...</p></div>' +
    '</div>';

  container.insertAdjacentHTML('beforeend', reviewSectionHtml);

  const loggedIn = !!getLoggedInUser();
  const formContainer = document.getElementById('reviewFormContainer');

  if (!loggedIn) {
    formContainer.innerHTML = '<p class="review-login-prompt"><a href="login.html">Log in</a> to write a review.</p>';
    loadReviews(productId);
    return;
  }

  let canReview = false;
  let reason = '';
  try {
    const eligibilityResponse = await fetch(API_URL + '/products/' + productId + '/can-review/', {
      headers: { 'Authorization': 'Bearer ' + getAccessToken() },
    });
    const eligibilityData = await eligibilityResponse.json();
    canReview = eligibilityData.can_review;
    reason = eligibilityData.reason;
  } catch (error) {
    console.error('Could not check review eligibility:', error);
  }

  if (!canReview) {
    if (reason === 'already_reviewed') {
      formContainer.innerHTML = '<p class="review-login-prompt">You have already reviewed this product.</p>';
    } else {
      formContainer.innerHTML = '<p class="review-login-prompt">Purchase this product to write a review.</p>';
    }
    loadReviews(productId);
    return;
  }

  formContainer.innerHTML =
    '<div class="review-form-box">' +
    '  <h3>Write a Review</h3>' +
    '  <div class="star-input" id="starInput">' +
    '    <i class="fa-regular fa-star" data-value="1"></i>' +
    '    <i class="fa-regular fa-star" data-value="2"></i>' +
    '    <i class="fa-regular fa-star" data-value="3"></i>' +
    '    <i class="fa-regular fa-star" data-value="4"></i>' +
    '    <i class="fa-regular fa-star" data-value="5"></i>' +
    '  </div>' +
    '  <textarea id="reviewComment" rows="3" placeholder="Share your thoughts about this product (optional)"></textarea>' +
    '  <button id="submitReviewBtn" class="auth-submit" style="width:200px;">Submit Review</button>' +
    '  <p id="reviewFormError" class="auth-error"></p>' +
    '</div>';

  document.querySelectorAll('#starInput i').forEach(function (star) {
    star.addEventListener('click', function () {
      selectedStarRating = Number(star.dataset.value);
      document.querySelectorAll('#starInput i').forEach(function (s) {
        const val = Number(s.dataset.value);
        s.className = val <= selectedStarRating ? 'fa-solid fa-star' : 'fa-regular fa-star';
      });
    });
  });

  document.getElementById('submitReviewBtn').addEventListener('click', function () {
    submitReview(productId);
  });

  loadReviews(productId);
}

async function loadReviews(productId) {
  const listContainer = document.getElementById('reviewsList');
  try {
    const response = await fetch(API_URL + '/products/' + productId + '/reviews/');
    if (!response.ok) {
      throw new Error('Failed to load reviews: ' + response.status);
    }
    const reviews = await response.json();
    renderReviewsList(reviews);
  } catch (error) {
    console.error('Could not load reviews:', error);
    listContainer.innerHTML = '<p>Could not load reviews.</p>';
  }
}

function renderReviewsList(reviews) {
  const listContainer = document.getElementById('reviewsList');

  if (reviews.length === 0) {
    listContainer.innerHTML = '<p class="no-reviews">No reviews yet. Be the first to review this product!</p>';
    return;
  }

  let html = '';
  reviews.forEach(function (review) {
    const starsHtml = buildReviewStarsHtml(review.rating);
    const date = new Date(review.created_at).toLocaleDateString('en-IN', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
    html +=
      '<div class="review-card">' +
      '  <div class="review-card-header">' +
      '    <strong>' + review.username + '</strong>' +
      '    <span class="review-date">' + date + '</span>' +
      '  </div>' +
      '  <div class="review-stars">' + starsHtml + '</div>' +
      (review.comment ? '<p class="review-comment">' + review.comment + '</p>' : '') +
      '</div>';
  });

  listContainer.innerHTML = html;
}

function buildReviewStarsHtml(rating) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += i <= rating ? '<i class="fa-solid fa-star"></i>' : '<i class="fa-regular fa-star"></i>';
  }
  return html;
}

async function submitReview(productId) {
  const errorBox = document.getElementById('reviewFormError');
  const btn = document.getElementById('submitReviewBtn');
  const comment = document.getElementById('reviewComment').value.trim();

  if (selectedStarRating === 0) {
    errorBox.textContent = 'Please select a star rating.';
    return;
  }

  errorBox.textContent = '';
  btn.textContent = 'Submitting...';
  btn.disabled = true;

  try {
    const response = await fetch(API_URL + '/products/' + productId + '/reviews/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getAccessToken(),
      },
      body: JSON.stringify({ rating: selectedStarRating, comment: comment }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Could not submit review.');
    }

    document.getElementById('reviewFormContainer').innerHTML = '<p class="review-thanks">Thanks for your review!</p>';
    loadReviews(productId);
  } catch (error) {
    errorBox.textContent = error.message;
    btn.textContent = 'Submit Review';
    btn.disabled = false;
  }
}

productsReady.then(renderProductPage);