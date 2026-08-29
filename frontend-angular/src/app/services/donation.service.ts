import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { CampaignConfig, CampaignStats, DonationCreatePayload, DonationResponse } from '../models/donation.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DonationService {
  public get apiUrl(): string {
    return environment.apiUrl;
  }

  // Fallback defaults
  public readonly defaultUpiId = 'vidarbhadholtashapathak@upi';
  public readonly defaultPayeeName = 'Vidarbha Dhol Tasha Pathak';

  constructor(private http: HttpClient) {}

  getConfig(): Observable<CampaignConfig | null> {
    return this.http.get<CampaignConfig>(`${this.apiUrl}/api/config`).pipe(
      catchError(err => {
        console.warn('Using default config fallback:', err);
        return of(null);
      })
    );
  }

  getStats(): Observable<CampaignStats | null> {
    return this.http.get<CampaignStats>(`${this.apiUrl}/api/stats`).pipe(
      catchError(err => {
        console.warn('Failed to fetch stats:', err);
        return of(null);
      })
    );
  }

  submitDonation(payload: DonationCreatePayload): Observable<DonationResponse> {
    return this.http.post<DonationResponse>(`${this.apiUrl}/api/donations`, payload);
  }

  buildUpiUrl(upiId: string, payeeName: string, amount: number, note = 'Nepal Relief - Vidarbha Dhol Tasha'): string {
    const amt = (amount || 1).toFixed(2);
    return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amt}&cu=INR&tn=${encodeURIComponent(note)}`;
  }

  buildAppSpecificUpiUrl(app: 'gpay' | 'phonepe' | 'paytm' | 'bhim' | 'generic', upiId: string, payeeName: string, amount: number): string {
    const amt = (amount || 1).toFixed(2);
    const params = `pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amt}&cu=INR&tn=${encodeURIComponent('Nepal Relief - Vidarbha Dhol Tasha')}`;

    switch (app) {
      case 'gpay':
        return `tez://upi/pay?${params}`;
      case 'phonepe':
        return `phonepe://pay?${params}`;
      case 'paytm':
        return `paytmmp://pay?${params}`;
      case 'bhim':
        return `bhim://pay?${params}`;
      default:
        return `upi://pay?${params}`;
    }
  }

  convertNumberToWords(num: number): string {
    const a = [
      '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
      'Seventeen', 'Eighteen', 'Nineteen'
    ];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const inWords = (n: number): string => {
      if (n < 20) return a[n];
      if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
      if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + inWords(n % 100) : '');
      if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
      if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + inWords(n % 100000) : '');
      return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + inWords(n % 10000000) : '');
    };

    const rounded = Math.floor(num);
    return (inWords(rounded) || 'Zero') + ' Rupees Only';
  }
}
