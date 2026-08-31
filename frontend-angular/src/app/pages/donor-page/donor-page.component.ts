import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DonationService } from '../../services/donation.service';
import { CampaignStats, DonationCreatePayload } from '../../models/donation.model';
import * as QRCode from 'qrcode';

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
    
    // Trigger deep link
    const link = document.createElement('a');
    link.href = targetUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    const names: Record<string, string> = {
      gpay: 'Google Pay',
      phonepe: 'PhonePe',
      paytm: 'Paytm',
      bhim: 'BHIM UPI',
      generic: 'UPI Payment App'
    };

    this.displayToast(`Opening ${names[app]}...`);
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

  // Manual submission toggle
  isManualUtrMode: boolean = false;

  toggleManualMode(): void {
    this.isManualUtrMode = !this.isManualUtrMode;
  }

  payViaGateway(): void {
    if (!this.formData.donor_name || this.formData.donor_name.trim().length < 2) {
      alert('Please enter your full name (minimum 2 characters).');
      return;
    }
    const phone = this.formData.phone?.trim() || '';
    if (!phone || phone.length < 10) {
      alert('Please enter a valid 10-digit mobile number.');
      return;
    }
    const amount = Number(this.formData.amount || this.currentAmount);
    if (!amount || amount <= 0) {
      alert('Please enter a valid donation amount greater than ₹0.');
      return;
    }

    this.isSubmitting = true;
    this.displayToast('Initializing secure payment gateway... ⏳');

    this.donationService.createOrder({
      amount: amount,
      donor_name: this.formData.donor_name.trim(),
      phone: phone,
      email: this.formData.email?.trim() || null
    }).subscribe({
      next: (order) => {
        this.launchRazorpay(order, amount);
      },
      error: (err) => {
        this.isSubmitting = false;
        alert('Failed to initialize payment gateway: ' + (err.error?.detail || err.message));
      }
    });
  }

  private launchRazorpay(order: any, amount: number): void {
    if (order.is_mock || typeof (window as any).Razorpay === 'undefined') {
      // Simulator for test placeholder keys / sandbox
      const confirmed = confirm(
        `[Secure Gateway Simulation]\n\nDonor: ${this.formData.donor_name}\nAmount: ₹${amount}\n\nClick OK to simulate successful bank payment.\nClick Cancel to simulate closing/cancelling.`
      );
      if (confirmed) {
        this.verifyAndCompletePayment({
          razorpay_order_id: order.order_id,
          razorpay_payment_id: 'pay_mock_' + Math.floor(100000000 + Math.random() * 900000000),
          razorpay_signature: 'mock_sig_' + Math.random().toString(36).substring(2),
          amount: amount
        });
      } else {
        this.isSubmitting = false;
        this.displayToast('Payment cancelled. No donation recorded.');
      }
      return;
    }

    const options: any = {
      key: order.key_id,
      amount: order.amount,
      currency: order.currency || 'INR',
      name: this.payeeName,
      description: `Nepal Relief Donation (₹${amount})`,
      order_id: order.order_id,
      prefill: {
        name: this.formData.donor_name,
        contact: this.formData.phone,
        email: this.formData.email || ''
      },
      theme: {
        color: '#ff6600'
      },
      handler: (response: any) => {
        this.verifyAndCompletePayment({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          amount: amount
        });
      },
      modal: {
        ondismiss: () => {
          this.isSubmitting = false;
          this.displayToast('Payment window closed. No donation recorded.');
        }
      }
    };

    try {
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (e: any) {
      this.isSubmitting = false;
      alert('Error opening payment window: ' + e.message);
    }
  }

  private verifyAndCompletePayment(payData: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string; amount: number }): void {
    this.displayToast('Verifying payment with bank... ⏳');

    this.donationService.verifyPayment({
      razorpay_order_id: payData.razorpay_order_id,
      razorpay_payment_id: payData.razorpay_payment_id,
      razorpay_signature: payData.razorpay_signature,
      donor_name: this.formData.donor_name.trim(),
      phone: this.formData.phone.trim(),
      email: this.formData.email?.trim() || null,
      city: this.formData.city?.trim() || null,
      amount: payData.amount,
      payment_mode: 'UPI (Gateway Confirmed)',
      message: this.formData.message?.trim() || null,
      is_anonymous: false
    }).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.displayToast('Payment confirmed by bank! Official receipt generated 🙏');

        this.receiptData = {
          receipt_no: res.receipt_no,
          donor_name: this.formData.donor_name.trim(),
          phone: this.formData.phone.trim(),
          email: this.formData.email?.trim() || null,
          city: this.formData.city?.trim() || null,
          amount: payData.amount,
          utr_number: payData.razorpay_payment_id,
          payment_mode: 'UPI (Gateway Verified)',
          payee_name: this.payeeName,
          created_at: new Date().toISOString(),
          amountInWords: this.donationService.convertNumberToWords(payData.amount),
          message: this.formData.message?.trim() || null,
          is_verified: true
        };
        this.showReceipt = true;

        this.resetForm();
        this.fetchStats();
      },
      error: (err) => {
        this.isSubmitting = false;
        alert('Payment verification failed: ' + (err.error?.detail || err.message));
      }
    });
  }

  resetForm(): void {
    this.formData.donor_name = '';
    this.formData.phone = '';
    this.formData.email = '';
    this.formData.city = '';
    this.formData.utr_number = '';
    this.formData.message = '';
  }

  onSubmit(): void {
    // If not in manual mode, use automated gateway
    if (!this.isManualUtrMode) {
      this.payViaGateway();
      return;
    }

    // Manual mode validation
    if (!this.formData.donor_name || !this.formData.phone || !this.formData.utr_number || !this.formData.amount) {
      alert('Please fill in all required fields marked with *');
      return;
    }

    const utr = this.formData.utr_number.trim();
    if (utr.length < 10) {
      alert('Please enter a valid 12-digit UPI UTR / Transaction Reference Number.');
      return;
    }

    this.isSubmitting = true;

    const payload: DonationCreatePayload = {
      donor_name: this.formData.donor_name.trim(),
      phone: this.formData.phone.trim(),
      email: this.formData.email.trim() || null,
      city: this.formData.city.trim() || null,
      amount: Number(this.formData.amount),
      utr_number: utr,
      payment_mode: this.formData.payment_mode,
      message: this.formData.message.trim() || null,
      is_anonymous: false
    };

    this.donationService.submitDonation(payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.displayToast('Donation submitted for admin verification! 🙏');

        // Show Receipt with pending status
        this.receiptData = {
          ...payload,
          receipt_no: res.receipt_no,
          payee_name: this.payeeName,
          created_at: new Date().toISOString(),
          amountInWords: this.donationService.convertNumberToWords(payload.amount),
          is_verified: false
        };
        this.showReceipt = true;

        this.resetForm();
        this.fetchStats();
      },
      error: (err) => {
        this.isSubmitting = false;
        alert(`Submission Failed: ${err.error?.detail || err.message}\nPlease check your transaction ID.`);
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
}
