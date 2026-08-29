/**
 * Admin Portal Logic
 */

let adminSecretKey = '';

function loginAdmin() {
  const input = document.getElementById('adminSecretInput');
  if (!input) return;
  adminSecretKey = input.value.trim();
  if (!adminSecretKey) {
    alert('Please enter Admin Secret Key');
    return;
  }

  loadAdminDonations();
}

async function loadAdminDonations() {
  const tableBody = document.getElementById('adminTableBody');
  const loginSection = document.getElementById('adminLoginCard');
  const dashboardSection = document.getElementById('adminDashboard');

  try {
    const res = await fetch(`${window.CONFIG.BACKEND_API_URL}/api/admin/donations`, {
      headers: {
        'x-admin-secret': adminSecretKey
      }
    });

    if (res.status === 401) {
      alert('Invalid Admin Key. Please try again.');
      return;
    }

    if (!res.ok) throw new Error('Failed to fetch admin records');

    const data = await res.json();

    if (loginSection) loginSection.style.display = 'none';
    if (dashboardSection) dashboardSection.style.display = 'block';

    renderAdminTable(data);
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

function renderAdminTable(donations) {
  const tableBody = document.getElementById('adminTableBody');
  if (!tableBody) return;

  if (donations.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 20px;">No donations recorded yet.</td></tr>`;
    return;
  }

  tableBody.innerHTML = donations.map(d => `
    <tr>
      <td style="font-family: monospace; font-weight: bold; color: #ff8c38;">${d.receipt_no}</td>
      <td><strong>${escapeHtml(d.donor_name)}</strong><br><small style="color: #94a3b8;">${escapeHtml(d.city || 'India')}</small></td>
      <td>${escapeHtml(d.phone)}<br><small style="color: #94a3b8;">${escapeHtml(d.email || '-')}</small></td>
      <td style="font-weight: bold; color: #f59e0b;">₹${Number(d.amount).toLocaleString('en-IN')}</td>
      <td style="font-family: monospace;">${escapeHtml(d.utr_number)}<br><small>${escapeHtml(d.payment_mode || 'UPI')}</small></td>
      <td><small style="color: #94a3b8;">${new Date(d.created_at).toLocaleString('en-IN')}</small></td>
      <td>
        <button onclick="toggleVerify(${d.id})" class="btn-verify ${d.is_verified ? 'verified' : 'pending'}">
          ${d.is_verified ? '✓ Verified' : '⏳ Pending'}
        </button>
      </td>
      <td><small style="font-style: italic;">${escapeHtml(d.message || '-')}</small></td>
    </tr>
  `).join('');
}

async function toggleVerify(donationId) {
  try {
    const res = await fetch(`${window.CONFIG.BACKEND_API_URL}/api/admin/donations/${donationId}/verify`, {
      method: 'PATCH',
      headers: {
        'x-admin-secret': adminSecretKey
      }
    });

    if (res.ok) {
      loadAdminDonations();
    } else {
      alert('Failed to update verification status');
    }
  } catch (err) {
    alert(err.message);
  }
}

function exportCsv() {
  const url = `${window.CONFIG.BACKEND_API_URL}/api/admin/export`;
  fetch(url, {
    headers: { 'x-admin-secret': adminSecretKey }
  })
  .then(res => {
    if (!res.ok) throw new Error('Export failed');
    return res.blob();
  })
  .then(blob => {
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `nepal_relief_donations_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  })
  .catch(err => alert(`Export error: ${err.message}`));
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}

window.loginAdmin = loginAdmin;
window.toggleVerify = toggleVerify;
window.exportCsv = exportCsv;
