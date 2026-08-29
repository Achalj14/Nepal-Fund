/**
 * Admin Portal Logic
 * Vidarbha Dhol Tasha Pathak - Nepal Relief Fund
 */

let adminSecretKey = '';
let allDonations = [];
let currentFilter = 'all'; // 'all' | 'pending' | 'verified'

// Toggle Password Visibility
function togglePasswordVisibility() {
  const input = document.getElementById('adminSecretInput');
  const btn = document.getElementById('btnToggleSecret');
  if (!input || !btn) return;

  if (input.type === 'password') {
    input.type = 'text';
    btn.innerText = '🙈';
    btn.title = 'Hide secret';
  } else {
    input.type = 'password';
    btn.innerText = '👁️';
    btn.title = 'Show secret';
  }
}

// Quick Fill Default Key helper
function fillDefaultKey() {
  const input = document.getElementById('adminSecretInput');
  if (input) {
    input.value = 'vidarbha@admin2026';
    input.focus();
    hideLoginAlert();
  }
}

// Show alert on login card
function showLoginAlert(message) {
  const alertBox = document.getElementById('loginAlertBox');
  if (alertBox) {
    alertBox.innerHTML = `<span>⚠️</span> <span>${escapeHtml(message)}</span>`;
    alertBox.style.display = 'flex';
  }
}

function hideLoginAlert() {
  const alertBox = document.getElementById('loginAlertBox');
  if (alertBox) {
    alertBox.style.display = 'none';
  }
}

// Login
async function loginAdmin() {
  hideLoginAlert();
  const input = document.getElementById('adminSecretInput');
  const submitBtn = document.getElementById('btnLoginSubmit');
  if (!input) return;

  const secret = input.value.trim();
  if (!secret) {
    showLoginAlert('Please enter your Admin Secret Key.');
    input.focus();
    return;
  }

  adminSecretKey = secret;

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>⏳</span> Verifying Key...`;
  }

  try {
    await loadAdminDonations();
    // Save to session so user doesn't have to re-type on refresh
    sessionStorage.setItem('vdtp_admin_secret', adminSecretKey);
  } catch (err) {
    console.error('Login error:', err);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>🔓</span> Login to Dashboard`;
    }
  }
}

// Logout
function logoutAdmin() {
  adminSecretKey = '';
  sessionStorage.removeItem('vdtp_admin_secret');
  
  const loginCard = document.getElementById('adminLoginCard');
  const dashboard = document.getElementById('adminDashboard');
  const navLogout = document.getElementById('btnNavLogout');
  const input = document.getElementById('adminSecretInput');

  if (loginCard) loginCard.style.display = 'block';
  if (dashboard) dashboard.style.display = 'none';
  if (navLogout) navLogout.style.display = 'none';
  if (input) {
    input.value = '';
    input.focus();
  }
}

// Load Donations from Backend
async function loadAdminDonations() {
  const tableBody = document.getElementById('adminTableBody');
  const loginSection = document.getElementById('adminLoginCard');
  const dashboardSection = document.getElementById('adminDashboard');
  const navLogout = document.getElementById('btnNavLogout');

  try {
    const res = await fetch(`${window.CONFIG.BACKEND_API_URL}/api/admin/donations`, {
      headers: {
        'x-admin-secret': adminSecretKey
      }
    });

    if (res.status === 401 || res.status === 403) {
      showLoginAlert('Invalid Admin Secret Key. Please check the key in backend .env and try again.');
      return;
    }

    if (!res.ok) {
      throw new Error(`Failed to fetch records (Status ${res.status})`);
    }

    allDonations = await res.json();

    // Show dashboard
    if (loginSection) loginSection.style.display = 'none';
    if (dashboardSection) dashboardSection.style.display = 'block';
    if (navLogout) navLogout.style.display = 'inline-block';

    // Update KPI stats & filter
    updateKpiStats(allDonations);
    handleSearchFilter();
  } catch (err) {
    showLoginAlert(`Connection Error: ${err.message}. Make sure your backend is running.`);
    throw err;
  }
}

// Update KPI Stats Cards
function updateKpiStats(donations) {
  const totalAmount = donations.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
  const totalCount = donations.length;
  const verifiedDonations = donations.filter(d => d.is_verified);
  const pendingDonations = donations.filter(d => !d.is_verified);

  const kpiAmount = document.getElementById('kpiTotalAmount');
  const kpiCount = document.getElementById('kpiTotalCount');
  const kpiVerified = document.getElementById('kpiVerifiedCount');
  const kpiPending = document.getElementById('kpiPendingCount');

  if (kpiAmount) kpiAmount.innerText = `₹${totalAmount.toLocaleString('en-IN')}`;
  if (kpiCount) kpiCount.innerText = totalCount.toLocaleString('en-IN');
  if (kpiVerified) kpiVerified.innerText = `${verifiedDonations.length} (₹${verifiedDonations.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0).toLocaleString('en-IN')})`;
  if (kpiPending) kpiPending.innerText = `${pendingDonations.length} (₹${pendingDonations.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0).toLocaleString('en-IN')})`;

  // Filter Pill Counters
  const countAll = document.getElementById('countFilterAll');
  const countPending = document.getElementById('countFilterPending');
  const countVerified = document.getElementById('countFilterVerified');

  if (countAll) countAll.innerText = totalCount;
  if (countPending) countPending.innerText = pendingDonations.length;
  if (countVerified) countVerified.innerText = verifiedDonations.length;
}

// Change Active Filter (All / Pending / Verified)
function setFilter(filterType, element) {
  currentFilter = filterType;
  document.querySelectorAll('.admin-filter-btn').forEach(btn => btn.classList.remove('active'));
  if (element) element.classList.add('active');
  handleSearchFilter();
}

// Live Search & Filter
function handleSearchFilter() {
  const searchInput = document.getElementById('adminSearchInput');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  let filtered = allDonations;

  // 1. Status Filter
  if (currentFilter === 'pending') {
    filtered = filtered.filter(d => !d.is_verified);
  } else if (currentFilter === 'verified') {
    filtered = filtered.filter(d => d.is_verified);
  }

  // 2. Search Query Filter
  if (query) {
    filtered = filtered.filter(d => {
      const name = (d.donor_name || '').toLowerCase();
      const utr = (d.utr_number || '').toLowerCase();
      const phone = (d.phone || '').toLowerCase();
      const email = (d.email || '').toLowerCase();
      const city = (d.city || '').toLowerCase();
      const receipt = (d.receipt_no || '').toLowerCase();
      const msg = (d.message || '').toLowerCase();

      return name.includes(query) ||
        utr.includes(query) ||
        phone.includes(query) ||
        email.includes(query) ||
        city.includes(query) ||
        receipt.includes(query) ||
        msg.includes(query);
    });
  }

  renderAdminTable(filtered);
}

// Render Table Rows
function renderAdminTable(donations) {
  const tableBody = document.getElementById('adminTableBody');
  if (!tableBody) return;

  if (donations.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding: 40px; color: var(--text-dim);">
          <div style="font-size: 1.5rem; margin-bottom: 8px;">🔍</div>
          No transaction records found matching the current criteria.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = donations.map(d => {
    const formattedDate = d.created_at ? new Date(d.created_at).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : '-';

    return `
      <tr>
        <td>
          <span style="font-family: monospace; font-weight: 700; color: var(--primary-saffron-light);">
            ${escapeHtml(d.receipt_no)}
          </span>
          <button type="button" class="copy-icon-btn" onclick="copyText('${escapeHtml(d.receipt_no)}', 'Receipt No')" title="Copy Receipt No">📋</button>
        </td>
        <td>
          <strong style="color: #fff; font-size: 0.95rem;">${escapeHtml(d.donor_name)}</strong>
          <br>
          <small style="color: var(--text-dim);">📍 ${escapeHtml(d.city || 'India')}</small>
        </td>
        <td>
          <span style="font-family: monospace; color: #e2e8f0;">${escapeHtml(d.phone)}</span>
          ${d.email ? `<br><small style="color: var(--text-dim);">${escapeHtml(d.email)}</small>` : ''}
        </td>
        <td>
          <span style="font-weight: 800; color: var(--primary-gold); font-size: 1rem;">
            ₹${Number(d.amount).toLocaleString('en-IN')}
          </span>
        </td>
        <td>
          <div class="badge-utr">
            <span>${escapeHtml(d.utr_number)}</span>
            <button type="button" class="copy-icon-btn" onclick="copyText('${escapeHtml(d.utr_number)}', 'UTR / Txn ID')" title="Copy UTR">📋</button>
          </div>
          <br>
          <small style="color: var(--text-dim); font-size: 0.75rem;">Mode: ${escapeHtml(d.payment_mode || 'UPI')}</small>
        </td>
        <td>
          <small style="color: var(--text-muted);">${formattedDate}</small>
        </td>
        <td>
          <button 
            type="button" 
            onclick="toggleVerify(${d.id})" 
            class="btn-verify ${d.is_verified ? 'verified' : 'pending'}"
            title="Click to toggle verification status"
          >
            ${d.is_verified ? '✓ Verified' : '⏳ Pending'}
          </button>
        </td>
        <td style="max-width: 200px;">
          <small style="color: var(--text-muted); font-style: ${d.message ? 'italic' : 'normal'};">
            ${d.message ? `"${escapeHtml(d.message)}"` : '-'}
          </small>
        </td>
      </tr>
    `;
  }).join('');
}

// Toggle Verification Status
async function toggleVerify(donationId) {
  try {
    const res = await fetch(`${window.CONFIG.BACKEND_API_URL}/api/admin/donations/${donationId}/verify`, {
      method: 'PATCH',
      headers: {
        'x-admin-secret': adminSecretKey
      }
    });

    if (res.ok) {
      await loadAdminDonations();
    } else {
      alert('Failed to update verification status. Please check your admin privileges.');
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// Export CSV Function
function exportCsv() {
  const url = `${window.CONFIG.BACKEND_API_URL}/api/admin/export`;
  
  fetch(url, {
    headers: { 'x-admin-secret': adminSecretKey }
  })
  .then(res => {
    if (!res.ok) throw new Error('Failed to generate CSV export. Please check admin secret.');
    return res.blob();
  })
  .then(blob => {
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `nepal_relief_donations_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
  })
  .catch(err => alert(`Export Error: ${err.message}`));
}

// Copy Text Helper
function copyText(text, label = 'Text') {
  navigator.clipboard.writeText(text).then(() => {
    alert(`Copied ${label}: ${text}`);
  }).catch(() => {
    prompt(`Copy ${label}:`, text);
  });
}

// Escape HTML utility to prevent XSS
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}

// Auto-check for stored session on load
document.addEventListener('DOMContentLoaded', () => {
  const savedSecret = sessionStorage.getItem('vdtp_admin_secret');
  if (savedSecret) {
    const input = document.getElementById('adminSecretInput');
    if (input) input.value = savedSecret;
    adminSecretKey = savedSecret;
    loadAdminDonations().catch(() => {
      sessionStorage.removeItem('vdtp_admin_secret');
    });
  }
});

// Expose globals for inline onclick handlers
window.loginAdmin = loginAdmin;
window.logoutAdmin = logoutAdmin;
window.togglePasswordVisibility = togglePasswordVisibility;
window.fillDefaultKey = fillDefaultKey;
window.loadAdminDonations = loadAdminDonations;
window.setFilter = setFilter;
window.handleSearchFilter = handleSearchFilter;
window.toggleVerify = toggleVerify;
window.exportCsv = exportCsv;
window.copyText = copyText;
