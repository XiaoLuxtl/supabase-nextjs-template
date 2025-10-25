export interface ApplyCreditResult {
  success: boolean;
  new_balance?: number;
  credits_added?: number;
  error_code?: string;
  error?: string;
  message?: string;
  already_applied?: boolean;
  transaction_id?: string;
}

export interface ProcessPaymentResponse {
  success: boolean;
  status?: string;
  credits_applied?: boolean;
  new_balance?: number;
  credits_added?: number;
  already_applied?: boolean;
  used_fallback?: boolean;
  error?: string;
  retryable?: boolean;
}

export interface ApiError extends Error {
  message: string;
  status?: number;
  retryable?: boolean;
  error_code?: string;
}

export interface ProcessResult {
  success: boolean;
  error?: string;
}

export interface CreditPurchase {
  id: string;
  user_id: string;
  credits_amount: number;
  applied_at: string | null;
  payment_status: string;
  created_at: string;
}

export type ResourceType = "payment" | "merchant_order";
export type Environment = "development" | "production";

export interface SecurityConfig {
  maxRequestsPerMinute: number;
  maxWebhookSize: number;
  requestTimeout: number;
  mpApiTimeout: number;
  dbTimeout: number;
}
