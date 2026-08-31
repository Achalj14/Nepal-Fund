export interface CampaignConfig {
  upi_id: string;
  payee_name: string;
  campaign_title: string;
  target_amount: number;
  currency: string;
  razorpay_key_id?: string;
}

export interface RazorpayOrderResponse {
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
}

export interface RazorpayVerifyPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  donor_name: string;
  phone: string;
  email?: string | null;
  city?: string | null;
  amount: number;
  message?: string | null;
  is_anonymous?: boolean;
}

export interface CampaignStats {
  total_raised: number;
  total_donors: number;
  target_amount: number;
  progress_percentage: number;
  currency: string;
  campaign_title: string;
  payee_name: string;
  upi_id: string;
}

export interface DonationCreatePayload {
  donor_name: string;
  phone: string;
  email?: string | null;
  city?: string | null;
  amount: number;
  utr_number: string;
  payment_mode?: string;
  payment_screenshot?: string | null;
  message?: string | null;
  is_anonymous?: boolean;
}

export interface DonationRecord {
  id: number;
  receipt_no: string;
  donor_name: string;
  phone: string;
  email?: string;
  city?: string;
  amount: number;
  utr_number: string;
  payment_mode?: string;
  payment_screenshot?: string;
  message?: string;
  is_anonymous: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface DonationResponse {
  message: string;
  receipt_no: string;
  donor_name: string;
  amount: number;
  created_at: string;
}

export interface OrderCreatePayload {
  amount: number;
  donor_name: string;
  phone: string;
  email?: string | null;
}

export interface OrderResponse {
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  is_mock?: boolean;
}

export interface PaymentVerifyPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  donor_name: string;
  phone: string;
  email?: string | null;
  city?: string | null;
  amount: number;
  payment_mode?: string;
  message?: string | null;
  is_anonymous?: boolean;
}

