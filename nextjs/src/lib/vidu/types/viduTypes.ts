export interface VideoGenerationRequest {
  image_base64?: string;
  prompt: string;
}

export interface VideoGenerationData {
  id: string;
  user_id: string;
  prompt: string;
  translated_prompt_en: string;
  model: string;
  duration: number;
  aspect_ratio: string;
  resolution: string;
  vidu_task_id: string | null;
  vidu_creation_id: string | null;
  status: string;
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
  vidu_full_response: unknown;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface CreditValidationResult {
  isValid: boolean;
  currentBalance: number;
  error?: string;
}

export interface NSFWCheckResult {
  isNSFW: boolean;
  reason?: string;
}

export interface VideoGenerationResult {
  success: boolean;
  generation?: VideoGenerationData;
  updatedCredits?: number;
  error?: string;
  message?: string;
}

export interface ImageProcessingResult {
  imageDescription: string;
  nsfwCheck?: NSFWCheckResult;
}

export interface CreditConsumptionResult {
  success: boolean;
  error?: string;
  newBalance?: number;
}

export interface ViduApiResponse {
  task_id?: string;
  [key: string]: unknown;
}
