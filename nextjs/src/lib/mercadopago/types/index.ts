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

export interface ApplyCreditResult {
  success: boolean;
  new_balance?: number;
  error?: string;
  already_applied?: boolean;
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
