import { ProcessResult, ResourceType } from "./types";
import { DevelopmentProcessor } from "./processors/development-processor";
import { ProductionProcessor } from "./processors/production-processor";

export { RateLimiter } from "./security/rate-limiter";
export { IPValidator } from "./security/ip-validator";
export { PayloadSanitizer } from "./security/payload-sanitizer";

/**
 * Main payment processing function
 */
export async function processPayment(
  paymentId: string,
  eventData?: unknown
): Promise<ProcessResult> {
  if (process.env.NODE_ENV === "development") {
    return DevelopmentProcessor.process(paymentId, "payment");
  }

  return ProductionProcessor.processPayment(paymentId);
}

/**
 * Processes merchant orders from Mercado Pago
 */
export async function processMerchantOrder(
  merchantOrderId: string,
  eventData?: unknown
): Promise<ProcessResult> {
  if (process.env.NODE_ENV === "development") {
    return DevelopmentProcessor.process(merchantOrderId, "merchant_order");
  }

  return ProductionProcessor.processMerchantOrder(merchantOrderId);
}

/**
 * Utility function for controlled delays
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
