import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DonationService } from '../../services/donation.service';
import { CampaignStats, DonationCreatePayload } from '../../models/donation.model';
import * as QRCode from 'qrcode';

declare var Razorpay: any;

@Component({
  selector: 'app-donor-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './donor-page.component.html',
  styleUrls: ['./donor-page.component.css']
})
export class DonorPageComponent implements OnInit, OnDestroy {
  // Amount & UPI state
  currentAmount: number = 501;
  upiId: string = 'vidarbhadholtashapathak@upi';
  payeeName: string = 'Vidarbha Dhol Tasha Pathak';
  campaignTitle: string = 'Nepal Tragedy Relief Fund';
  qrDataUrl: string = '';

  // Suggestion Pills
  presetAmounts: number[] = [101, 251, 501, 1001, 2100, 5001];

  // Campaign Stats
  stats: CampaignStats = {
    total_raised: 0,
    total_donors: 0,
    target_amount: 500000,
    progress_percentage: 0,
    currency: 'INR',
    campaign_title: 'Nepal Tragedy Relief Fund',
    payee_name: 'Vidarbha Dhol Tasha Pathak',
    upi_id: 'vidarbhadholtashapathak@upi'
  };

  // Form Model
  formData = {
    donor_name: '',
    phone: '',
    email: '',
    city: '',
    amount: 501,
    utr_number: '',
    payment_mode: 'Google Pay',
    message: ''
  };

  // UI States
  isSubmitting = false;
  isProcessingRazorpay = false;
  isRetrievingPayment = false;
  isUtrLocked = false;
  isPaymentCompleted = false;
  razorpayKeyId = '';
  toastMessage = '';
  showToast = false;
  toastTimeout: any;

  // Receipt Modal State
  showReceipt = false;
  showImageSaveModal = false;
  receiptImageUrl = '';
  receiptData: any = null;

  private pollInterval: any;

  constructor(public donationService: DonationService) {}

  ngOnInit(): void {
    this.fetchConfig();
    this.fetchStats();
    this.generateQR();

    // Auto-retry for backend cold-starts
    setTimeout(() => this.fetchStats(), 3000);
    setTimeout(() => this.fetchStats(), 8000);

    // Poll stats every 30s
    this.pollInterval = setInterval(() => this.fetchStats(), 30000);
  }

  ngOnDestroy(): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
  }

  fetchConfig(): void {
    this.donationService.getConfig().subscribe(cfg => {
      if (cfg) {
        this.upiId = cfg.upi_id || this.upiId;
        this.payeeName = cfg.payee_name || this.payeeName;
        this.campaignTitle = cfg.campaign_title || this.campaignTitle;
        if (cfg.razorpay_key_id) {
          this.razorpayKeyId = cfg.razorpay_key_id;
        }
        this.generateQR();
      }
    });
  }

  fetchStats(): void {
    this.donationService.getStats().subscribe(stats => {
      if (stats) {
        this.stats = stats;
      }
    });
  }

  setAmount(amt: number): void {
    this.currentAmount = amt;
    this.formData.amount = amt;
    this.generateQR();
  }

  onAmountInput(): void {
    const val = Number(this.currentAmount);
    if (val && val > 0) {
      this.formData.amount = val;
      this.generateQR();
    }
  }

  onFormAmountInput(): void {
    const val = Number(this.formData.amount);
    if (val && val > 0) {
      this.currentAmount = val;
      this.generateQR();
    }
  }

  async generateQR(): Promise<void> {
    const upiUrl = this.donationService.buildUpiUrl(this.upiId, this.payeeName, this.currentAmount);
    try {
      this.qrDataUrl = await QRCode.toDataURL(upiUrl, {
        width: 220,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      });
    } catch (err) {
      // Fallback
      this.qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiUrl)}`;
    }
  }

  payViaApp(app: 'gpay' | 'phonepe' | 'paytm' | 'bhim' | 'generic'): void {
    const targetUrl = this.donationService.buildAppSpecificUpiUrl(app, this.upiId, this.payeeName, this.currentAmount);
    
    const names: Record<string, string> = {
      gpay: 'Google Pay',
      phonepe: 'PhonePe',
      paytm: 'Paytm',
      bhim: 'BHIM UPI',
      generic: 'UPI Payment App'
    };

    this.formData.payment_mode = names[app] || 'UPI';
    this.formData.amount = this.currentAmount;

    // Trigger deep link
    const link = document.createElement('a');
    link.href = targetUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.displayToast(`Opening ${names[app]}... Enter transaction UTR below once paid!`);

    const utrInput = document.getElementById('utrNumber');
    if (utrInput) {
      setTimeout(() => {
        utrInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        utrInput.focus();
      }, 800);
    }
  }

  copyUpiId(): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(this.upiId).then(() => {
        this.displayToast(`Copied UPI ID: ${this.upiId}`);
      }).catch(() => {
        prompt('Copy UPI ID:', this.upiId);
      });
    }
  }

  displayToast(msg: string): void {
    this.toastMessage = msg;
    this.showToast = true;
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.showToast = false;
    }, 3000);
  }

  onSubmit(): void {
    if (!this.formData.donor_name || !this.formData.phone || !this.formData.utr_number || !this.formData.amount) {
      alert('Please fill in all required fields marked with *');
      return;
    }

    this.isSubmitting = true;

    const payload: DonationCreatePayload = {
      donor_name: this.formData.donor_name.trim(),
      phone: this.formData.phone.trim(),
      email: this.formData.email ? this.formData.email.trim() : null,
      city: this.formData.city ? this.formData.city.trim() : null,
      amount: Number(this.formData.amount),
      utr_number: this.formData.utr_number.trim(),
      payment_mode: this.formData.payment_mode || 'Razorpay Online',
      message: this.formData.message ? this.formData.message.trim() : null,
      is_anonymous: false
    };

    this.donationService.submitDonation(payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.isPaymentCompleted = true;
        this.isUtrLocked = true;
        this.displayToast('Donation details recorded in database successfully! 🙏');

        // Show Receipt
        this.receiptData = {
          ...payload,
          receipt_no: res.receipt_no || (this.receiptData ? this.receiptData.receipt_no : 'VDTP-NPL-0001'),
          payee_name: this.payeeName,
          created_at: res.created_at || (this.receiptData ? this.receiptData.created_at : new Date().toISOString()),
          payment_mode: payload.payment_mode,
          utr_number: payload.utr_number,
          amountInWords: this.donationService.convertNumberToWords(payload.amount)
        };
        this.showReceipt = true;

        // Clear form fields after successful submission as requested
        this.formData.donor_name = '';
        this.formData.phone = '';
        this.formData.email = '';
        this.formData.city = '';
        this.formData.utr_number = '';
        this.formData.message = '';
        this.formData.payment_mode = 'Google Pay';
        this.formData.amount = this.currentAmount;
        this.isUtrLocked = false;
        this.isPaymentCompleted = false;

        // Refresh stats
        this.fetchStats();
      },
      error: (err) => {
        this.isSubmitting = false;
        alert(`Submission Failed: ${err.error?.detail || err.message}\nPlease check your connection.`);
      }
    });
  }

  closeReceipt(): void {
    this.showReceipt = false;
  }

  openReceiptModal(): void {
    if (!this.receiptData) {
      this.displayToast('Please complete or submit donation first.');
      return;
    }
    this.showReceipt = true;
  }

  downloadReceipt(): void {
    if (!this.receiptData) {
      alert('No receipt details available to download.');
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 900;
      canvas.height = 1250;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        this.printReceipt();
        return;
      }

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 900, 1250);

      // Outer Border
      ctx.strokeStyle = '#ff6b00';
      ctx.lineWidth = 8;
      ctx.strokeRect(18, 18, 864, 1214);

      // Inner Border
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.strokeRect(30, 30, 840, 1190);

      // Header Brand Card
      ctx.fillStyle = '#fff7ed';
      ctx.fillRect(32, 32, 836, 175);

      // Header Text
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff6b00';
      ctx.font = 'bold 36px "Segoe UI", Arial, sans-serif';
      ctx.fillText('विदर्भ ढोल ताशा पथक', 450, 90);

      ctx.fillStyle = '#1e293b';
      ctx.font = '600 19px "Segoe UI", Arial, sans-serif';
      ctx.fillText('VIDARBHA DHOL TASHA PATHAK • NAGPUR, MAHARASHTRA', 450, 125);

      ctx.fillStyle = '#dc2626';
      ctx.font = 'bold 17px "Segoe UI", Arial, sans-serif';
      ctx.fillText('NEPAL TRAGEDY HUMANITARIAN RELIEF FUND', 450, 155);

      ctx.fillStyle = '#64748b';
      ctx.font = '14px "Segoe UI", Arial, sans-serif';
      ctx.fillText('Official Relief Donation Acknowledgment & Receipt', 450, 185);

      // Receipt Badge Pill
      ctx.fillStyle = '#ff6b00';
      ctx.beginPath();
      ctx.roundRect(270, 222, 360, 42, 21);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 17px "Segoe UI", Arial, sans-serif';
      ctx.fillText('OFFICIAL DONATION RECEIPT', 450, 249);

      // Meta Cards
      const drawCard = (x: number, y: number, w: number, h: number, label: string, val: string, isAccent = false) => {
        ctx.fillStyle = isAccent ? '#fff7ed' : '#f8fafc';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = isAccent ? '#fed7aa' : '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
        ctx.fillText(label.toUpperCase(), x + 16, y + 24);

        ctx.fillStyle = isAccent ? '#ea580c' : '#0f172a';
        ctx.font = isAccent ? 'bold 17px monospace' : '600 15px "Segoe UI", Arial, sans-serif';
        ctx.fillText(val, x + 16, y + 52);
      };

      const dateStr = this.receiptData.created_at
        ? new Date(this.receiptData.created_at).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : new Date().toLocaleDateString('en-IN');

      drawCard(60, 285, 370, 70, 'Receipt Number', this.receiptData.receipt_no || 'VDTP-NPL-0001', true);
      drawCard(470, 285, 370, 70, 'Date & Time', dateStr);
      drawCard(60, 370, 370, 70, 'Cause / Purpose', 'Nepal Relief & Rehabilitation');
      drawCard(470, 370, 370, 70, 'Payment Mode', this.receiptData.payment_mode || 'Razorpay / UPI');

      // Amount Box
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(60, 465, 780, 115);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.strokeRect(60, 465, 780, 115);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#92400e';
      ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
      ctx.fillText('CONTRIBUTION AMOUNT RECEIVED', 450, 498);

      ctx.fillStyle = '#b45309';
      ctx.font = 'bold 42px "Segoe UI", Arial, sans-serif';
      ctx.fillText(`₹${Number(this.receiptData.amount).toLocaleString('en-IN')}`, 450, 542);

      ctx.fillStyle = '#78350f';
      ctx.font = '600 15px "Segoe UI", Arial, sans-serif';
      ctx.fillText(this.receiptData.amountInWords || this.donationService.convertNumberToWords(this.receiptData.amount), 450, 568);

      // Donor Information Rows
      ctx.textAlign = 'left';
      let rowY = 635;
      const drawRow = (label: string, value: string, isMono = false) => {
        ctx.fillStyle = '#64748b';
        ctx.font = '600 16px "Segoe UI", Arial, sans-serif';
        ctx.fillText(label, 80, rowY);

        ctx.fillStyle = '#0f172a';
        ctx.font = isMono ? 'bold 16px monospace' : '700 16px "Segoe UI", Arial, sans-serif';
        ctx.fillText(value, 330, rowY);

        ctx.strokeStyle = '#f1f5f9';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(80, rowY + 12);
        ctx.lineTo(820, rowY + 12);
        ctx.stroke();

        rowY += 45;
      };

      drawRow('Donor Full Name:', this.receiptData.donor_name);
      drawRow('Mobile / WhatsApp:', this.receiptData.phone);
      if (this.receiptData.email) drawRow('Email Address:', this.receiptData.email);
      if (this.receiptData.city) drawRow('City / State:', this.receiptData.city);
      drawRow('Transaction ID / UTR:', this.receiptData.utr_number, true);
      if (this.receiptData.message) {
        drawRow('Donor Message:', `"${this.receiptData.message}"`);
      }

      // Stamp (Left Bottom)
      ctx.save();
      ctx.translate(170, 1075);
      ctx.rotate(-0.05);
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 3;
      ctx.strokeRect(-100, -32, 200, 64);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
      ctx.fillRect(-100, -32, 200, 64);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#059669';
      ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
      ctx.fillText('★ VERIFIED ★', 0, -8);
      ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
      ctx.fillText('ACKNOWLEDGEMENT', 0, 12);
      ctx.font = '10px "Segoe UI", Arial, sans-serif';
      ctx.fillText('VIDARBHA DHOL TASHA', 0, 24);
      ctx.restore();

      // Signatory (Right Bottom)
      ctx.textAlign = 'right';
      ctx.fillStyle = '#64748b';
      ctx.font = '14px "Segoe UI", Arial, sans-serif';
      ctx.fillText('Authorized Signatory', 820, 1070);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
      ctx.fillText('Vidarbha Dhol Tasha Pathak', 820, 1095);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px "Segoe UI", Arial, sans-serif';
      ctx.fillText('Nagpur, Maharashtra, India', 820, 1115);

      // Footnote
      ctx.textAlign = 'center';
      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px "Segoe UI", Arial, sans-serif';
      ctx.fillText('Thank you for standing in solidarity with our brothers and sisters in Nepal 🇳🇵 🇮🇳', 450, 1175);
      ctx.fillText('This is a verified computer-generated receipt.', 450, 1195);

      // Generate Image
      const dataUrl = canvas.toDataURL('image/png');
      this.receiptImageUrl = dataUrl;
      const safeReceiptNo = (this.receiptData.receipt_no || 'VDTP-Receipt').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Donation-Receipt-${safeReceiptNo}.png`;

      // 1. Direct PNG File Download to device
      canvas.toBlob((blob) => {
        if (blob) {
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        } else {
          const link = document.createElement('a');
          link.href = dataUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
        this.displayToast('Receipt PNG downloaded to your device! 📥');
      }, 'image/png');

      // 2. If on mobile (iOS/Android), also show the image preview modal for easy photo saving
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        this.showImageSaveModal = true;
      }

    } catch (error) {
      console.error('Failed to generate receipt image:', error);
      this.printReceipt();
    }
  }

  triggerNativeShare(): void {
    if (!this.receiptImageUrl || !this.receiptData) {
      this.downloadReceipt();
      return;
    }

    fetch(this.receiptImageUrl)
      .then(res => res.blob())
      .then(async blob => {
        const safeReceiptNo = (this.receiptData.receipt_no || 'VDTP-Receipt').replace(/[^a-zA-Z0-9_-]/g, '_');
        const file = new File([blob], `Donation-Receipt-${safeReceiptNo}.png`, { type: 'image/png' });
        if ((navigator as any).canShare && (navigator as any).canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Official Donation Receipt',
            text: `Donation Receipt - ${this.receiptData.receipt_no}`
          });
        } else {
          const w = window.open();
          if (w) {
            w.document.write(`<img src="${this.receiptImageUrl}" style="max-width:100%;height:auto;"/>`);
          }
        }
      })
      .catch(err => {
        console.error('Share error:', err);
      });
  }

  printReceipt(): void {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }

  shareOnWhatsApp(): void {
    if (!this.receiptData) return;
    const text = `🚩 *Donation Acknowledged - Nepal Relief Fund*\n\n` +
      `*Receipt No:* ${this.receiptData.receipt_no}\n` +
      `*Donor:* ${this.receiptData.donor_name}\n` +
      `*Amount:* ₹${Number(this.receiptData.amount).toLocaleString('en-IN')}\n` +
      `*Organization:* Vidarbha Dhol Tasha Pathak\n\n` +
      `Standing with our brothers & sisters in Nepal 🇳🇵🇮🇳. Contribute now: ${window.location.origin}`;

    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  }

  payWithRazorpay(): void {
    const donorName = (this.formData.donor_name || '').trim();
    const donorPhone = (this.formData.phone || '').trim();
    const amount = Number(this.currentAmount || this.formData.amount);

    if (!donorName || !donorPhone) {
      alert('Please enter your Full Name and Mobile Number first so we can link your verified donation receipt.');
      const nameEl = document.getElementById('donorName');
      if (nameEl) {
        nameEl.focus();
        nameEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    if (!amount || amount <= 0) {
      alert('Please specify a valid contribution amount.');
      return;
    }

    if (typeof Razorpay === 'undefined') {
      alert('Razorpay Checkout SDK is still loading. Please check your connection or refresh the page.');
      return;
    }

    this.isProcessingRazorpay = true;
    this.displayToast('Initializing secure Razorpay payment...');

    this.donationService.createRazorpayOrder(amount).subscribe({
      next: (orderRes) => {
        const options: any = {
          key: orderRes.key_id || this.razorpayKeyId,
          amount: Math.round(orderRes.amount * 100),
          currency: orderRes.currency || 'INR',
          name: this.campaignTitle || 'Nepal Tragedy Relief Fund',
          description: `Relief Fund Contribution - ₹${amount}`,
          order_id: orderRes.order_id,
          prefill: {
            name: donorName,
            contact: donorPhone,
            email: this.formData.email ? this.formData.email.trim() : ''
          },
          notes: {
            city: this.formData.city ? this.formData.city.trim() : '',
            message: this.formData.message ? this.formData.message.trim() : ''
          },
          theme: {
            color: '#ff6b00'
          },
          method: {
            upi: true,
            card: true,
            netbanking: true,
            wallet: true
          },
          config: {
            display: {
              blocks: {
                upi: {
                  name: 'Pay via UPI (Google Pay, PhonePe, Paytm, BHIM)',
                  instruments: [
                    {
                      method: 'upi'
                    }
                  ]
                },
                other: {
                  name: 'Cards, Netbanking & Wallets',
                  instruments: [
                    { method: 'card' },
                    { method: 'netbanking' },
                    { method: 'wallet' }
                  ]
                }
              },
              sequence: ['block.upi', 'block.other'],
              preferences: {
                show_default_blocks: true
              }
            }
          },
          handler: (response: any) => {
            this.handleRazorpaySuccess(response, amount);
          },
          modal: {
            ondismiss: () => {
              this.isProcessingRazorpay = false;
              this.displayToast('Payment popup closed.');
            }
          }
        };

        const rzp = new Razorpay(options);
        rzp.on('payment.failed', (failRes: any) => {
          this.isProcessingRazorpay = false;
          alert(`Payment Failed: ${failRes.error?.description || 'Transaction unsuccessful'}`);
        });
        rzp.open();
      },
      error: (err) => {
        this.isProcessingRazorpay = false;
        alert(`Failed to initialize Razorpay order: ${err.error?.detail || err.message}`);
      }
    });
  }

  private handleRazorpaySuccess(paymentResponse: any, amount: number): void {
    this.isRetrievingPayment = true;
    this.isProcessingRazorpay = true;
    this.displayToast('Payment captured! Retrieving verified details...');

    const payload = {
      razorpay_order_id: paymentResponse.razorpay_order_id,
      razorpay_payment_id: paymentResponse.razorpay_payment_id,
      razorpay_signature: paymentResponse.razorpay_signature,
      donor_name: this.formData.donor_name.trim(),
      phone: this.formData.phone.trim(),
      email: this.formData.email ? this.formData.email.trim() : null,
      city: this.formData.city ? this.formData.city.trim() : null,
      amount: amount,
      message: this.formData.message ? this.formData.message.trim() : null,
      is_anonymous: false
    };

    this.donationService.verifyRazorpayPayment(payload).subscribe({
      next: (res) => {
        this.isRetrievingPayment = false;
        this.isProcessingRazorpay = false;
        this.displayToast('Payment verified successfully! 🙏');

        const receipt = res.receipt || {};
        this.receiptData = {
          ...payload,
          receipt_no: res.receipt_no || receipt.receipt_no,
          payee_name: this.payeeName,
          created_at: receipt.created_at || new Date().toISOString(),
          payment_mode: 'Razorpay Online',
          utr_number: paymentResponse.razorpay_payment_id,
          amountInWords: this.donationService.convertNumberToWords(amount)
        };
        this.showReceipt = true;

        // Auto-fill transaction ID and lock to prevent editing
        this.formData.utr_number = paymentResponse.razorpay_payment_id;
        this.formData.amount = amount;
        this.formData.payment_mode = 'Razorpay Online';
        this.isUtrLocked = true;
        this.isPaymentCompleted = true;

        // Immediately update donor count & raised funds
        this.fetchStats();
      },
      error: (err) => {
        this.isRetrievingPayment = false;
        this.isProcessingRazorpay = false;
        alert(`Payment verification failed: ${err.error?.detail || err.message}\nRazorpay Payment ID: ${paymentResponse.razorpay_payment_id}`);
      }
    });
  }
}
