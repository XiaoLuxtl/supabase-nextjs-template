// /types/types.ts

export interface ApplyCreditResult {
  success: boolean;
  new_balance?: number;
  credits_added?: number;
  error_code?: string;
  error?: string;
  message?: string;
  already_applied?: boolean;
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
