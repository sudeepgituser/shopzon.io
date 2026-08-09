// auth.js
//
// Talks to the real Django backend (JWT auth via djangorestframework-simplejwt).

console.log('AUTH.JS STARTED');
const API_BASE = "http://" + window.location.hostname + ":8000/api";

const AUTH_STORAGE_KEY = 'loggedInUser';
const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

function getLoggedInUser() {
  return localStorage.getItem(AUTH_STORAGE_KEY);
}

function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch (err) {
    return null;
  }
}

function isAdminUser() {
  const token = getAccessToken();
  if (!token) {
    return false;
  }
  const payload = decodeToken(token);
  return !!(payload && payload.is_staff);
}

function requireLogin() {
  if (!getLoggedInUser() || !getAccessToken()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

function saveSession(username, access, refresh) {
  localStorage.setItem(AUTH_STORAGE_KEY, username);
  localStorage.setItem(ACCESS_TOKEN_KEY, access);
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
}

function logOut() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  updateSignInLabel();
  window.location.href = 'index.html';
}

async function loginUser(username, password) {
  try {
    const response = await fetch(API_BASE + '/auth/login/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { ok: false, error: data.detail || 'Login failed. Check your username and password.' };
    }

    saveSession(username, data.access, data.refresh);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: 'Could not reach the server. Is Django running on port 8000?' };
  }
}

async function registerUser(username, email, password) {
  try {
    const response = await fetch(API_BASE + '/auth/register/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, email: email, password: password }),
    });

    const data = await response.json();

    if (!response.ok) {
      const firstError = Object.values(data)[0];
      const message = Array.isArray(firstError) ? firstError[0] : 'Could not create account.';
      return { ok: false, error: message };
    }

    return await loginUser(username, password);
  } catch (err) {
    return { ok: false, error: 'Could not reach the server. Is Django running on port 8000?' };
  }
}

// ---------- TOKEN REFRESH ----------
// Access tokens are short-lived (5 min). This exchanges the long-lived
// refresh token for a new access token, without forcing the user to
// log in again mid-session.
async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  try {
    const response = await fetch(API_BASE + '/auth/refresh/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!response.ok) {
      // Refresh token itself is expired/invalid -- nothing we can do
      // but force a real re-login.
      return null;
    }

    const data = await response.json();
    localStorage.setItem(ACCESS_TOKEN_KEY, data.access);
    return data.access;
  } catch (err) {
    return null;
  }
}

// ---------- authFetch ----------
// Drop-in replacement for fetch() on any request that needs
// "Authorization: Bearer <token>". If the first attempt comes back 401
// (expired access token), it silently refreshes and retries ONCE.
// If the refresh itself fails, it sends the user to login.
async function authFetch(url, options) {
  options = options || {};
  options.headers = options.headers || {};

  let token = getAccessToken();
  options.headers['Authorization'] = 'Bearer ' + token;

  let response = await fetch(url, options);

  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      window.location.href = 'login.html';
      return response;
    }
    options.headers['Authorization'] = 'Bearer ' + newToken;
    response = await fetch(url, options);
  }

  return response;
}

function updateSignInLabel() {
  const user = getLoggedInUser();

  const label = document.getElementById('signInLabel');
  const subtext = document.getElementById('signInSubtext');
  const signInLink = document.getElementById('signInLink');
  const sideLabel = document.getElementById('sideMenuSignInLabel');
  const adminLink = document.getElementById('adminPanelLink');

  const loggedInBar = document.getElementById('loggedInBar');
  const loggedInBarName = document.getElementById('loggedInBarName');
  const loggedInBarLogout = document.getElementById('loggedInBarLogout');

  if (loggedInBar && loggedInBarName) {
    if (user) {
      loggedInBar.style.display = 'block';
      loggedInBarName.textContent = user;
    } else {
      loggedInBar.style.display = 'none';
    }
  }

  if (loggedInBarLogout && !loggedInBarLogout.dataset.wired) {
    loggedInBarLogout.dataset.wired = 'true';
    loggedInBarLogout.addEventListener('click', function (event) {
      event.preventDefault();
      logOut();
    });
  }

  if (adminLink) {
    adminLink.style.display = isAdminUser() ? 'flex' : 'none';
  }

  if (label) {
    label.textContent = user ? 'Hello, ' + user : 'Hello, sign in';
  }

  if (sideLabel) {
    sideLabel.textContent = user ? 'Hello, ' + user : 'Hello, sign in';
  }

  if (subtext && signInLink) {
    if (user) {
      subtext.textContent = 'Sign out';
      signInLink.setAttribute('href', '#');
      signInLink.onclick = function (event) {
        event.preventDefault();
        logOut();
      };
    } else {
      subtext.textContent = 'Account & lists';
      signInLink.setAttribute('href', 'login.html');
      signInLink.onclick = null;
    }
  }
}

document.addEventListener('DOMContentLoaded', updateSignInLabel);
console.log('AUTH.JS FINISHED, requireLogin is:', typeof requireLogin);


// ---------- LOGIN-GATED NAV LINKS ----------
// Cart, Orders, and Returns & Account links should send a logged-out
// visitor to login.html first, carrying a ?next= so they land back on
// the page they actually wanted right after signing in.
function guardLoginRequiredLinks() {
  const selectors = [
    'a[href="cart.html"]',
    'a[href="orders.html"]',
    '#cartBtn',
  ];

  document.querySelectorAll(selectors.join(',')).forEach(function (link) {
    link.addEventListener('click', function (event) {
      if (!getLoggedInUser() || !getAccessToken()) {
        event.preventDefault();
        const destination = link.getAttribute('href') || 'index.html';
        window.location.href = 'login.html?next=' + encodeURIComponent(destination);
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', guardLoginRequiredLinks);