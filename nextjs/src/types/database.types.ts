/**
 * Tipos TypeScript para las tablas de Supabase
 * Generados manualmente basados en el schema
 */

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  credits_balance: number;
  total_credits_purchased: number;
  total_videos_generated: number;
  daily_generation_limit: number;
  daily_generations_used: number;
  daily_reset_date: string;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface CreditPackage {
  id: string;
  name: string;
  slug: string;
  package_type: 'fixed' | 'custom';
  credits_amount: number | null; // null si es custom
  price_mxn: number | null; // null si es custom
  min_credits: number | null; // solo para custom
  price_per_credit: number | null; // solo para custom
  description: string | null;
  features: string[] | null;
  is_active: boolean;
  is_popular: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreditPurchase {
  id: string;
  user_id: string;
  package_id: string | null;
  package_name: string;
  credits_amount: number;
  price_paid_mxn: number;
  payment_method: string;
  payment_id: string | null;
  preference_id: string | null;
  payment_status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded';
  notes: string | null;
  applied_at: string | null;
  created_at: string;
}

export interface VideoGeneration {
  id: string;
  user_id: string;
  prompt: string;
  input_image_url: string;
  input_image_path: string | null;
  model: string;
  duration: number;
  aspect_ratio: string;
  resolution: string;
  vidu_task_id: string | null;
  vidu_creation_id: string | null;
  status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  credits_used: number;
  video_url: string | null;
  cover_url: string | null;
  video_duration_actual: number | null;
  video_fps: number | null;
  bgm: boolean;
  error_message: string | null;
  error_code: string | null;
  retry_count: number;
  max_retries: number;
  vidu_full_response: ViduSuccessResponse | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  balance_after: number;
  transaction_type: 'purchase' | 'video_generation' | 'refund' | 'admin_adjustment' | 'bonus';
  purchase_id: string | null;
  video_id: string | null;
  description: string;
  created_at: string;
}

export interface ViduWebhookLog {
  id: string;
  vidu_task_id: string | null;
  payload: any;
  processed: boolean;
  error_message: string | null;
  received_at: string;
}

// ============================================
// TIPOS DE RESPUESTA DE VIDU API
// ============================================

export interface ViduSuccessResponse {
  state: 'success';
  err_code: '';
  creations: Array<{
    id: string;
    url: string;
    cover_url: string;
    watermarked_url: string;
    moderation_url: string[];
    video: {
      duration: number;
      fps: number;
      resolution: string | null;
    };
  }>;
  id: string; // task_id
  credits: number;
  bgm: boolean;
  payload: string;
  cus_priority: number;
  off_peak: boolean;
}

export interface ViduErrorResponse {
  state: 'error';
  err_code: string;
  err_msg: string;
}

export type ViduResponse = ViduSuccessResponse | ViduErrorResponse;

// ============================================
// TIPOS DE REQUEST
// ============================================

export interface CreateVideoRequest {
  prompt: string;
  image_base64: string;
}

export interface CreatePurchaseRequest {
  package_id: string;
  credits_amount?: number; // Solo para custom packages
}

// ============================================
// TIPOS DE RESPONSE DE LA API
// ============================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface UserDashboard {
  profile: UserProfile;
  recent_videos: VideoGeneration[];
  recent_purchases: CreditPurchase[];
  stats: {
    total_videos: number;
    completed_videos: number;
    pending_videos: number;
    total_spent: number;
  };
}