/**
 * Main Application Logic
 * Vidarbha Dhol Tasha Pathak - Nepal Relief Fund
 */

let currentAmount = 501;
let currentUpiId = window.CONFIG.DEFAULT_UPI_ID;
let currentPayeeName = window.CONFIG.DEFAULT_PAYEE_NAME;
let qrInstance = null;

// Toast Utility
function showToast(message, duration = 3000) {
  let toast = document.getElementById('appToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'appToast';
    toast.className = 'toast-box';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span>🔔</span> <span>${message}</span>`;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

// Generate / Update UPI QR Code
function updateQRCode() {
  const qrContainer = document.getElementById('qrcode');
  if (!qrContainer) return;

  const amtNum = parseFloat(currentAmount) || 1;
  const formattedAmt = amtNum.toFixed(2);

  // UPI deep link standard specification
  const upiUrl = `upi://pay?pa=${encodeURIComponent(currentUpiId)}&pn=${encodeURIComponent(currentPayeeName)}&am=${formattedAmt}&cu=INR&tn=${encodeURIComponent("Nepal Relief - Vidarbha Dhol Tasha")}`;

  // Clear previous QR
  qrContainer.innerHTML = '';

  if (typeof QRCode !== 'undefined') {
    qrInstance = new QRCode(qrContainer, {
      text: upiUrl,
      width: 200,
      height: 200,
      colorDark: '#0f172a',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  } else {
    // Fallback QR image service if local library fails to load
    const img = document.createElement('img');
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUrl)}`;
    img.alt = `UPI QR Code for ₹${formattedAmt}`;
    img.width = 200;
    img.height = 200;
    qrContainer.appendChild(img);
  }

  // Update visual text indicators
  const badge = document.getElementById('qrAmountBadge');
  if (badge) badge.innerText = `Scan to Pay ₹${Number(amtNum).toLocaleString('en-IN')}`;

  // Update mobile UPI link button
  const mobileBtn = document.getElementById('btnPayUpiMobile');
  if (mobileBtn) {
    mobileBtn.onclick = () => {
      window.location.href = upiUrl;
    };
  }
}

// Select preset amount pills
function selectAmount(amt, el) {
  currentAmount = amt;
  
  // Highlight active pill
  document.querySelectorAll('.pill-btn').forEach(btn => btn.classList.remove('active'));
  if (el) el.classList.add('active');

  // Update form input
  const formAmt = document.getElementById('formAmount');
  if (formAmt) formAmt.value = amt;

  updateQRCode();
}

// Fetch Campaign Config & Live Stats from Backend
async function loadCampaignData() {
  try {
    const configRes = await fetch(`${window.CONFIG.BACKEND_API_URL}/api/config`);
    if (configRes.ok) {
      const cfg = await configRes.json();
      currentUpiId = cfg.upi_id || currentUpiId;
      currentPayeeName = cfg.payee_name || currentPayeeName;

      // Update UI elements
      const upiText = document.getElementById('displayUpiId');
      if (upiText) upiText.innerText = currentUpiId;
      const payeeText = document.getElementById('displayPayeeName');
      if (payeeText) payeeText.innerText = currentPayeeName;
    }
  } catch (err) {
    console.warn('Using default campaign config:', err);
  }

  // Render QR with latest config
  updateQRCode();

  // Load live stats
  await refreshLiveStats();
}

// Fetch and update live statistics
async function refreshLiveStats() {
  try {
    const statsRes = await fetch(`${window.CONFIG.BACKEND_API_URL}/api/stats`);
    if (statsRes.ok) {
      const stats = await statsRes.json();
      const raisedEl = document.getElementById('statTotalRaised');
      const donorsEl = document.getElementById('statTotalDonors');

      if (raisedEl) raisedEl.innerText = `₹${Number(stats.total_raised).toLocaleString('en-IN')}`;
      if (donorsEl) donorsEl.innerText = Number(stats.total_donors).toLocaleString('en-IN');
      return true;
    }
  } catch (err) {
    console.warn('Could not fetch stats (backend may be waking up):', err);
  }
  return false;
}

// Fetch Recent Donors
async function loadRecentDonors() {
  const container = document.getElementById('donorCardsContainer');
  if (!container) return;

  try {
    const res = await fetch(`${window.CONFIG.BACKEND_API_URL}/api/donations?limit=12`);
    if (!res.ok) throw new Error('Failed to load donors');
    const donors = await res.json();

    if (donors.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; color: var(--text-dim); padding: 30px;">
          Be the first generous donor to support our brothers and sisters in Nepal! 🚩
        </div>
      `;
      return;
    }

    container.innerHTML = donors.map(d => {
      const dateStr = d.created_at ? new Date(d.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Recently';
      return `
        <div class="donor-card">
          <div class="donor-card-top">
            <div>
              <div class="donor-card-name">${escapeHtml(d.donor_name)}</div>
              <div class="donor-card-city">📍 ${escapeHtml(d.city || 'India')}</div>
            </div>
            <div class="donor-card-amount">₹${Number(d.amount).toLocaleString('en-IN')}</div>
          </div>
          ${d.message ? `<div class="donor-card-msg">"${escapeHtml(d.message)}"</div>` : ''}
          <div class="donor-card-date">${dateStr}</div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.warn('Could not load donors:', err);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}

// Copy UPI ID function
function copyUpiId() {
  navigator.clipboard.writeText(currentUpiId).then(() => {
    showToast(`Copied UPI ID: ${currentUpiId}`);
  }).catch(() => {
    showToast('Failed to copy. Please select and copy manually.');
  });
}

// Initialize listeners on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Sync form amount input with QR
  const formAmt = document.getElementById('formAmount');
  if (formAmt) {
    formAmt.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (val && val > 0) {
        currentAmount = val;
        // Deselect pills if custom amount
        document.querySelectorAll('.pill-btn').forEach(btn => btn.classList.remove('active'));
        updateQRCode();
      }
    });
  }

  // Handle Form Submission
  const form = document.getElementById('donationForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btnSubmitForm');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>⏳</span> Recording Donation...`;
      }

      const payload = {
        donor_name: document.getElementById('donorName').value.trim(),
        phone: document.getElementById('donorPhone').value.trim(),
        email: document.getElementById('donorEmail').value.trim() || null,
        city: document.getElementById('donorCity').value.trim() || null,
        amount: parseFloat(document.getElementById('formAmount').value),
        utr_number: document.getElementById('utrNumber').value.trim(),
        payment_mode: document.getElementById('paymentMode').value,
        message: document.getElementById('donorMessage').value.trim() || null,
        is_anonymous: document.getElementById('isAnonymous') ? document.getElementById('isAnonymous').checked : false
      };

      try {
        const res = await fetch(`${window.CONFIG.BACKEND_API_URL}/api/donations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const result = await res.json();

        if (!res.ok) {
          throw new Error(result.detail || 'Error submitting donation');
        }

        showToast('Donation details recorded successfully! 🙏');

        // Show receipt modal
        window.showReceiptModal({
          ...payload,
          receipt_no: result.receipt_no,
          payee_name: currentPayeeName
        });

        // Reset form
        form.reset();
        document.getElementById('formAmount').value = currentAmount;

        // Refresh stats & donor wall
        loadCampaignData();
      } catch (err) {
        alert(`Submission Failed: ${err.message}\n\nPlease check your internet connection or backend URL.`);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span>🙏</span> Submit Donation & Get Official Receipt`;
        }
      }
    });
  }

  // Load initial campaign data
  loadCampaignData();

  // Retry after 3s & 8s in case backend was waking up from cold-sleep
  setTimeout(() => refreshLiveStats(), 3000);
  setTimeout(() => refreshLiveStats(), 8000);

  // Poll stats every 30 seconds
  setInterval(() => refreshLiveStats(), 30000);
});

// Expose globals
window.selectAmount = selectAmount;
window.copyUpiId = copyUpiId;
