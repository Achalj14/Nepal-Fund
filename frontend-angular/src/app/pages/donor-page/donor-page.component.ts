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
  isUtrLocked = false;
  isPaymentCompleted = false;
  razorpayKeyId = '';
  toastMessage = '';
  showToast = false;
  toastTimeout: any;

  // Receipt Modal State
  showReceipt = false;
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
    if (this.isPaymentCompleted) {
      this.showReceipt = true;
      return;
    }

    if (!this.formData.donor_name || !this.formData.phone || !this.formData.utr_number || !this.formData.amount) {
      alert('Please fill in all required fields marked with *');
      return;
    }

    this.isSubmitting = true;

    const payload: DonationCreatePayload = {
      donor_name: this.formData.donor_name.trim(),
      phone: this.formData.phone.trim(),
      email: this.formData.email.trim() || null,
      city: this.formData.city.trim() || null,
      amount: Number(this.formData.amount),
      utr_number: this.formData.utr_number.trim(),
      payment_mode: this.formData.payment_mode,
      message: this.formData.message.trim() || null,
      is_anonymous: false
    };

    this.donationService.submitDonation(payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.displayToast('Donation recorded successfully! 🙏');

        // Show Receipt
        this.receiptData = {
          ...payload,
          receipt_no: res.receipt_no,
          payee_name: this.payeeName,
          created_at: res.created_at || new Date().toISOString(),
          amountInWords: this.donationService.convertNumberToWords(payload.amount)
        };
        this.showReceipt = true;

        // Reset form
        this.formData.donor_name = '';
        this.formData.phone = '';
        this.formData.email = '';
        this.formData.city = '';
        this.formData.utr_number = '';
        this.formData.message = '';

        // Refresh stats
        this.fetchStats();
      },
      error: (err) => {
        this.isSubmitting = false;
        alert(`Submission Failed: ${err.error?.detail || err.message}\nPlease check your backend connection.`);
      }
    });
  }

  closeReceipt(): void {
    this.showReceipt = false;
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
    this.displayToast('Payment successful! Verifying and recording your receipt...');

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
        this.isProcessingRazorpay = false;
        alert(`Payment verification failed: ${err.error?.detail || err.message}\nRazorpay Payment ID: ${paymentResponse.razorpay_payment_id}`);
      }
    });
  }
}
