import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DonationRecord } from '../models/donation.model';
import { DonationService } from './donation.service';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private readonly storageKey = 'vdtp_admin_secret';

  constructor(
    private http: HttpClient,
    private donationService: DonationService
  ) {}

  getSavedSecret(): string {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(this.storageKey) || '';
    }
    return '';
  }

  saveSecret(secret: string): void {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(this.storageKey, secret);
    }
  }

  clearSecret(): void {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(this.storageKey);
    }
  }

  getDonations(secret: string): Observable<DonationRecord[]> {
    const headers = new HttpHeaders({ 'x-admin-secret': secret });
    return this.http.get<DonationRecord[]>(`${this.donationService.apiUrl}/api/admin/donations`, { headers });
  }

  toggleVerify(donationId: number, secret: string): Observable<DonationRecord> {
    const headers = new HttpHeaders({ 'x-admin-secret': secret });
    return this.http.patch<DonationRecord>(
      `${this.donationService.apiUrl}/api/admin/donations/${donationId}/verify`,
      {},
      { headers }
    );
  }

  exportCsv(secret: string): Observable<Blob> {
    const headers = new HttpHeaders({ 'x-admin-secret': secret });
    return this.http.get(`${this.donationService.apiUrl}/api/admin/export`, {
      headers,
      responseType: 'blob'
    });
  }
}
