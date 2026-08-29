import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminService } from '../../services/admin.service';
import { DonationRecord } from '../../models/donation.model';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-page.component.html',
  styleUrls: ['./admin-page.component.css']
})
export class AdminPageComponent implements OnInit {
  secretKey: string = '';
  isPasswordVisible: boolean = false;
  isAuthenticated: boolean = false;
  isLoading: boolean = false;
  errorMessage: string = '';

  allDonations: DonationRecord[] = [];
  filteredDonations: DonationRecord[] = [];
  searchQuery: string = '';
  currentFilter: 'all' | 'pending' | 'verified' = 'all';

  // KPI Metrics
  totalFunds: number = 0;
  totalTransactions: number = 0;
  verifiedCount: number = 0;
  verifiedAmount: number = 0;
  pendingCount: number = 0;
  pendingAmount: number = 0;

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    const saved = this.adminService.getSavedSecret();
    if (saved) {
      this.secretKey = saved;
      this.login();
    }
  }

  togglePasswordVisibility(): void {
    this.isPasswordVisible = !this.isPasswordVisible;
  }

  fillDefaultKey(): void {
    this.secretKey = 'vidarbha@admin2026';
    this.errorMessage = '';
  }

  login(): void {
    const secret = this.secretKey.trim();
    if (!secret) {
      this.errorMessage = 'Please enter your Admin Secret Key.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.adminService.getDonations(secret).subscribe({
      next: (donations) => {
        this.isLoading = false;
        this.isAuthenticated = true;
        this.adminService.saveSecret(secret);
        this.allDonations = donations;
        this.calculateMetrics();
        this.applyFilter();
      },
      error: (err) => {
        this.isLoading = false;
        if (err.status === 401 || err.status === 403) {
          this.errorMessage = 'Invalid Admin Secret Key. Please check your key and try again.';
        } else {
          this.errorMessage = `Connection Error: ${err.message}. Ensure your backend server is online.`;
        }
      }
    });
  }

  logout(): void {
    this.isAuthenticated = false;
    this.secretKey = '';
    this.adminService.clearSecret();
    this.allDonations = [];
    this.filteredDonations = [];
  }

  refresh(): void {
    if (!this.isAuthenticated) return;
    this.login();
  }

  calculateMetrics(): void {
    this.totalFunds = this.allDonations.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    this.totalTransactions = this.allDonations.length;

    const verified = this.allDonations.filter(d => d.is_verified);
    const pending = this.allDonations.filter(d => !d.is_verified);

    this.verifiedCount = verified.length;
    this.verifiedAmount = verified.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

    this.pendingCount = pending.length;
    this.pendingAmount = pending.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  }

  setFilter(filter: 'all' | 'pending' | 'verified'): void {
    this.currentFilter = filter;
    this.applyFilter();
  }

  applyFilter(): void {
    let result = this.allDonations;

    // Status Filter
    if (this.currentFilter === 'pending') {
      result = result.filter(d => !d.is_verified);
    } else if (this.currentFilter === 'verified') {
      result = result.filter(d => d.is_verified);
    }

    // Search Query
    const q = this.searchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter(d => {
        const name = (d.donor_name || '').toLowerCase();
        const utr = (d.utr_number || '').toLowerCase();
        const phone = (d.phone || '').toLowerCase();
        const email = (d.email || '').toLowerCase();
        const city = (d.city || '').toLowerCase();
        const receipt = (d.receipt_no || '').toLowerCase();
        const msg = (d.message || '').toLowerCase();

        return name.includes(q) || utr.includes(q) || phone.includes(q) || email.includes(q) || city.includes(q) || receipt.includes(q) || msg.includes(q);
      });
    }

    this.filteredDonations = result;
  }

  toggleVerify(donationId: number): void {
    this.adminService.toggleVerify(donationId, this.secretKey.trim()).subscribe({
      next: () => {
        this.login();
      },
      error: (err) => {
        alert(`Failed to update verification status: ${err.message}`);
      }
    });
  }

  exportCsv(): void {
    this.adminService.exportCsv(this.secretKey.trim()).subscribe({
      next: (blob) => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `nepal_relief_donations_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
      },
      error: (err) => {
        alert(`Export Error: ${err.message}`);
      }
    });
  }

  copyText(text: string, label: string): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        alert(`Copied ${label}: ${text}`);
      }).catch(() => {
        prompt(`Copy ${label}:`, text);
      });
    }
  }
}
