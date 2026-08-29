/**
 * Receipt Generation & Sharing Handler
 */

function numberToIndianWords(num) {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';
  let str = '';
  str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
  str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
  str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
  str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
  str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + 'Only' : 'Only';
  return str.trim();
}

function showReceiptModal(data) {
  const modal = document.getElementById('receiptModal');
  const paper = document.getElementById('receiptPaperContent');
  if (!modal || !paper) return;

  const formattedAmount = Number(data.amount).toLocaleString('en-IN');
  const words = numberToIndianWords(Math.round(data.amount));
  const dateStr = data.created_at || new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  paper.innerHTML = `
    <div class="receipt-header">
      <div class="receipt-org-title">🚩 Vidarbha Dhol Tasha Pathak</div>
      <div class="receipt-sub">Nepal Tragedy Relief Donation Acknowledgement</div>
      <div class="receipt-badge">✓ Official Digital Acknowledgment</div>
    </div>
    
    <div class="receipt-amount-highlight">
      <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 2px;">DONATION AMOUNT</div>
      <div class="r-amt">₹${formattedAmount}</div>
      <div style="font-size: 0.8rem; color: #475569; font-weight: 600; margin-top: 4px;">(${words})</div>
    </div>

    <div class="receipt-body">
      <div class="receipt-grid-row">
        <span class="r-label">Receipt Reference No:</span>
        <span class="r-val" style="font-family: monospace; color: #c2410c;">${data.receipt_no || 'VDTP-NPL-PENDING'}</span>
      </div>
      <div class="receipt-grid-row">
        <span class="r-label">Donor Name:</span>
        <span class="r-val">${data.donor_name}</span>
      </div>
      <div class="receipt-grid-row">
        <span class="r-label">Phone / WhatsApp:</span>
        <span class="r-val">${data.phone || 'N/A'}</span>
      </div>
      <div class="receipt-grid-row">
        <span class="r-label">City / State:</span>
        <span class="r-val">${data.city || 'India'}</span>
      </div>
      <div class="receipt-grid-row">
        <span class="r-label">UPI Reference / UTR:</span>
        <span class="r-val" style="font-family: monospace;">${data.utr_number}</span>
      </div>
      <div class="receipt-grid-row">
        <span class="r-label">Date & Time:</span>
        <span class="r-val">${dateStr}</span>
      </div>
      <div class="receipt-grid-row">
        <span class="r-label">Beneficiary:</span>
        <span class="r-val">${data.payee_name || 'Vidarbha Dhol Tasha Pathak'}</span>
      </div>
    </div>

    <div class="receipt-seal">
      <div>
        <div style="font-size: 0.7rem; color: #94a3b8;">This is a computer generated receipt.</div>
        <div style="font-size: 0.75rem; color: #059669; font-weight: 600; margin-top: 2px;">Thank you for standing with Nepal! 🇳🇵 🇮🇳</div>
      </div>
      <div class="receipt-stamp">PAYMENT RECORDED</div>
    </div>
  `;

  // WhatsApp share link
  const waBtn = document.getElementById('btnShareWhatsApp');
  if (waBtn) {
    const text = encodeURIComponent(
      `🚩 *Vidarbha Dhol Tasha Pathak - Nepal Relief Fund*\n\n` +
      `I have contributed *₹${formattedAmount}* towards Nepal Tragedy Relief.\n` +
      `Receipt No: *${data.receipt_no}*\n` +
      `Transaction UTR: *${data.utr_number}*\n\n` +
      `Join us in supporting our brothers & sisters in Nepal! 🙏`
    );
    waBtn.onclick = () => {
      window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    };
  }

  modal.classList.add('active');
}

function closeReceiptModal() {
  const modal = document.getElementById('receiptModal');
  if (modal) modal.classList.remove('active');
}

function printReceipt() {
  window.print();
}

window.showReceiptModal = showReceiptModal;
window.closeReceiptModal = closeReceiptModal;
window.printReceipt = printReceipt;
