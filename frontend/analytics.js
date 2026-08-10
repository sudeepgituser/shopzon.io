// analytics.js
//
// Runs only on analytics.html. Fetches aggregated stats from
// /api/orders/admin/analytics/ and renders them as three charts using
// Chart.js: a revenue line chart, a top-products bar chart, and an
// order-status pie chart.

const STATUS_COLORS = {
  processing: '#f4952b',
  shipped: '#0b5fb0',
  delivered: '#1a7a1a',
  cancelled: '#b3261e',
};

const STATUS_LABELS = {
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

async function loadAnalytics() {
  if (!requireLogin()) {
    return;
  }
  if (!isAdminUser()) {
    document.getElementById('analyticsLoading').innerHTML = '<p>You do not have permission to view this page.</p>';
    return;
  }

  const token = getAccessToken();

  try {
    const response = await fetch(API_URL + '/orders/admin/analytics/', {
      headers: { 'Authorization': 'Bearer ' + token },
    });

    if (response.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    if (response.status === 403) {
      document.getElementById('analyticsLoading').innerHTML = '<p>You do not have permission to view this page.</p>';
      return;
    }
    if (!response.ok) {
      throw new Error('Failed to load analytics: ' + response.status);
    }

    const data = await response.json();
    renderAnalytics(data);
  } catch (error) {
    console.error('Could not load analytics:', error);
    document.getElementById('analyticsLoading').style.display = 'none';
    document.getElementById('analyticsError').textContent = 'Something went wrong loading analytics. Please try again.';
  }
}

function renderAnalytics(data) {
  document.getElementById('analyticsLoading').style.display = 'none';
  document.getElementById('analyticsContent').style.display = 'block';

  document.getElementById('statRevenue').textContent = 'Rs.' + data.total_revenue.toLocaleString('en-IN');
  document.getElementById('statOrders').textContent = data.total_orders.toLocaleString('en-IN');
  document.getElementById('statCustomers').textContent = data.total_customers.toLocaleString('en-IN');

  const revenueLabels = data.revenue_by_day.map(function (d) {
    return new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  });
  const revenueValues = data.revenue_by_day.map(function (d) { return d.revenue; });

  new Chart(document.getElementById('revenueChart'), {
    type: 'line',
    data: {
      labels: revenueLabels,
      datasets: [{
        label: 'Revenue (Rs.)',
        data: revenueValues,
        borderColor: '#007185',
        backgroundColor: 'rgba(0, 113, 133, 0.1)',
        fill: true,
        tension: 0.3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });

  const productLabels = data.top_products.map(function (p) { return p.title; });
  const productValues = data.top_products.map(function (p) { return p.units_sold; });

  new Chart(document.getElementById('topProductsChart'), {
    type: 'bar',
    data: {
      labels: productLabels,
      datasets: [{
        label: 'Units Sold',
        data: productValues,
        backgroundColor: '#f4952b',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } },
    },
  });

  const statusLabels = data.status_breakdown.map(function (s) { return STATUS_LABELS[s.status] || s.status; });
  const statusValues = data.status_breakdown.map(function (s) { return s.count; });
  const statusColors = data.status_breakdown.map(function (s) { return STATUS_COLORS[s.status] || '#999'; });

  new Chart(document.getElementById('statusChart'), {
    type: 'doughnut',
    data: {
      labels: statusLabels,
      datasets: [{
        data: statusValues,
        backgroundColor: statusColors,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
    },
  });
}

loadAnalytics();
