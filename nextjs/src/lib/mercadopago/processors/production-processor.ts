import { MercadoPagoConfig, Payment, MerchantOrder } from "mercadopago";
import { SupabaseClient } from "../clients/supabase-client";
import { CreditApplier } from "./credit-applier";
import { ProcessResult, CreditPurchase } from "../types";
import { RateLimiter } from "../security/rate-limiter";

interface MercadoPagoError {
  status?: number;
  code?: string;
  message?: string;
  response?: {
    data?: unknown;
  };
}

interface MercadoPagoPayment {
  id: string;
  status: string;
  external_reference?: string;
  transaction_amount?: number;
  date_created?: string;
}

interface MercadoPagoMerchantOrder {
  payments: Array<{ id?: number | string }>;
}

// Clients para producción con timeouts de seguridad (CORREGIDO)
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
  options: {
    timeout: RateLimiter.getConfig().mpApiTimeout,
    // Removido: headers no es una opción válida en el SDK
  },
});

const paymentClient = new Payment(mpClient);
const merchantOrderClient = new MerchantOrder(mpClient);

export class ProductionProcessor {
  /**
   * Processes a real payment from Mercado Pago with security checks
   */
  static async processPayment(paymentId: string): Promise<ProcessResult> {
    // Validación de formato del paymentId
    if (!this.isValidMercadoPagoId(paymentId)) {
      console.error(`❌ Invalid payment ID format: ${paymentId}`);
      await SupabaseClient.logWebhook(
        paymentId,
        "payment",
        { invalid_payment_id: paymentId },
        null,
        false,
        "Invalid payment ID format"
      );
      return { success: false, error: "Invalid payment ID format" };
    }

    let payment;

    // Retry logic with security timeouts
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`🔄 Retry attempt ${attempt} for payment ${paymentId}`);
          await this.sleep(2000);
        }

        payment = await this.fetchPaymentWithTimeout(paymentId);
        console.log(`✅ Payment ${paymentId} found on attempt ${attempt}`);
        break;
      } catch (error: unknown) {
        const mpError = error as MercadoPagoError;
        const isLastAttempt = attempt === 3;

        if (mpError.status === 404 && !isLastAttempt) {
          continue;
        }

        console.error(
          `❌ Failed to fetch payment ${paymentId}:`,
          mpError.message
        );

        await SupabaseClient.logWebhook(
          paymentId,
          "payment",
          { error: mpError.message, attempt },
          null,
          false,
          `Payment fetch failed: ${mpError.message}`
        );

        return {
          success: false,
          error: `Payment not found: ${mpError.message}`,
        };
      }
    }

    if (!payment) {
      await SupabaseClient.logWebhook(
        paymentId,
        "payment",
        { payment_id: paymentId },
        null,
        false,
        "Payment not found after retries"
      );
      return { success: false, error: "Payment not found after retries" };
    }

    const mpPayment = payment as MercadoPagoPayment;

    // Validate external reference
    const purchaseId = mpPayment.external_reference;
    if (!purchaseId || !this.isValidUUID(purchaseId)) {
      console.error(`❌ Invalid external_reference: ${purchaseId}`);

      await SupabaseClient.logWebhook(
        paymentId,
        "payment",
        {
          payment_id: paymentId,
          external_reference: purchaseId,
        },
        null,
        false,
        "Invalid external reference"
      );

      return { success: false, error: "Invalid purchase reference" };
    }

    // Validate purchase exists and is legitimate
    const purchaseValidation = await this.validatePurchase(purchaseId, payment);
    if (!purchaseValidation.valid) {
      await SupabaseClient.logWebhook(
        paymentId,
        "payment",
        {
          payment_id: paymentId,
          purchase_id: purchaseId,
          validation_error: purchaseValidation.error,
        },
        null,
        false,
        `Purchase validation failed: ${purchaseValidation.error}`
      );

      return { success: false, error: purchaseValidation.error };
    }

    // Update purchase record
    const { error: updateError } = await SupabaseClient.updatePurchaseStatus(
      purchaseId,
      mpPayment.id?.toString() || paymentId
    );

    if (updateError) {
      console.error(`❌ Failed to update purchase ${purchaseId}:`, updateError);

      await SupabaseClient.logWebhook(
        paymentId,
        "payment",
        {
          payment_id: paymentId,
          purchase_id: purchaseId,
          update_error: updateError.message,
        },
        null,
        false,
        `Purchase update failed: ${updateError.message}`
      );

      return {
        success: false,
        error: `Failed to update purchase: ${updateError.message}`,
      };
    }

    // Apply credits
    const creditResult = await CreditApplier.applyCredits(purchaseId);
    if (!creditResult.success) {
      await SupabaseClient.logWebhook(
        paymentId,
        "payment",
        {
          payment_id: paymentId,
          purchase_id: purchaseId,
          credit_error: creditResult.error,
        },
        null,
        false,
        `Credit application failed: ${creditResult.error}`
      );

      return creditResult;
    }

    // Log successful processing
    await SupabaseClient.logWebhook(
      paymentId,
      "payment",
      {
        payment_id: paymentId,
        purchase_id: purchaseId,
        credits_applied: true,
      },
      null,
      true,
      "Payment processed successfully"
    );

    console.log(`✅ PRODUCTION: Applied credits for purchase ${purchaseId}`);
    return { success: true };
  }

  /**
   * Processes merchant orders from Mercado Pago
   */
  static async processMerchantOrder(
    merchantOrderId: string
  ): Promise<ProcessResult> {
    // Validación de formato
    if (!this.isValidMercadoPagoId(merchantOrderId)) {
      console.error(`❌ Invalid merchant order ID format: ${merchantOrderId}`);

      await SupabaseClient.logWebhook(
        merchantOrderId,
        "merchant_order",
        { invalid_merchant_order_id: merchantOrderId },
        null,
        false,
        "Invalid merchant order ID format"
      );

      return { success: false, error: "Invalid merchant order ID format" };
    }

    try {
      const merchantOrder = (await this.fetchMerchantOrderWithTimeout(
        merchantOrderId
      )) as MercadoPagoMerchantOrder;

      if (!merchantOrder.payments || merchantOrder.payments.length === 0) {
        await SupabaseClient.logWebhook(
          merchantOrderId,
          "merchant_order",
          { merchant_order_id: merchantOrderId },
          null,
          false,
          "No payments found in merchant order"
        );

        return { success: false, error: "No payments found in merchant order" };
      }

      const paymentId = merchantOrder.payments[0].id?.toString();
      if (!paymentId) {
        await SupabaseClient.logWebhook(
          merchantOrderId,
          "merchant_order",
          {
            merchant_order_id: merchantOrderId,
            payments: merchantOrder.payments,
          },
          null,
          false,
          "Invalid payment ID in merchant order"
        );

        return {
          success: false,
          error: "Invalid payment ID in merchant order",
        };
      }

      // Log merchant order processing
      await SupabaseClient.logWebhook(
        merchantOrderId,
        "merchant_order",
        {
          merchant_order_id: merchantOrderId,
          payment_id: paymentId,
          payments_count: merchantOrder.payments.length,
        },
        null,
        true,
        "Merchant order processed successfully"
      );

      return this.processPayment(paymentId);
    } catch (error: unknown) {
      const mpError = error as MercadoPagoError;
      console.error(
        `❌ Merchant order error ${merchantOrderId}:`,
        mpError.message
      );

      await SupabaseClient.logWebhook(
        merchantOrderId,
        "merchant_order",
        {
          merchant_order_id: merchantOrderId,
          error: mpError.message,
        },
        null,
        false,
        `Merchant order processing failed: ${mpError.message}`
      );

      return {
        success: false,
        error: `Merchant order processing failed: ${mpError.message}`,
      };
    }
  }

  /**
   * Validates purchase legitimacy with security checks
   */
  private static async validatePurchase(
    purchaseId: string,
    payment: unknown
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const mpPayment = payment as MercadoPagoPayment;
      const purchase = await SupabaseClient.findPurchaseById(purchaseId);

      if (!purchase) {
        return { valid: false, error: "Purchase not found" };
      }

      // Validar que no esté ya aprobada (previene replay attacks)
      if (purchase.payment_status === "approved") {
        return { valid: false, error: "Purchase already processed" };
      }

      // Validar que el estado sea pending (seguridad adicional)
      if (purchase.payment_status !== "pending") {
        return {
          valid: false,
          error: `Invalid purchase status: ${purchase.payment_status}`,
        };
      }

      // Validación de monto (opcional - para prevenir manipulación)
      if (this.shouldValidateAmount() && mpPayment.transaction_amount) {
        const expectedAmount = this.calculateExpectedAmount(purchase);
        const paymentAmount = mpPayment.transaction_amount;

        if (Math.abs(expectedAmount - paymentAmount) > 0.01) {
          console.warn(
            `🚨 Amount mismatch for purchase ${purchaseId}: expected ${expectedAmount}, got ${paymentAmount}`
          );
          // No rechazar inmediatamente, pero loggear para investigación
        }
      }

      return { valid: true };
    } catch (error) {
      console.error(`❌ Purchase validation error for ${purchaseId}:`, error);
      return { valid: false, error: "Purchase validation failed" };
    }
  }

  /**
   * Calcula el monto esperado basado en la compra
   */
  private static calculateExpectedAmount(purchase: CreditPurchase): number {
    // Lógica para calcular el monto esperado basado en créditos
    // Esto depende de tu modelo de precios
    return purchase.credits_amount * 50; // Ejemplo: 50 MXN por crédito
  }

  /**
   * Determina si debe validarse el monto (solo en producción estricta)
   */
  private static shouldValidateAmount(): boolean {
    return (
      process.env.NODE_ENV === "production" &&
      process.env.STRICT_AMOUNT_VALIDATION === "true"
    );
  }

  /**
   * Fetches payment with timeout
   */
  private static async fetchPaymentWithTimeout(
    paymentId: string
  ): Promise<unknown> {
    const timeout = RateLimiter.getConfig().mpApiTimeout;

    return Promise.race([
      paymentClient.get({ id: paymentId }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("MP API timeout")), timeout)
      ),
    ]);
  }

  /**
   * Fetches merchant order with timeout
   */
  private static async fetchMerchantOrderWithTimeout(
    merchantOrderId: string
  ): Promise<unknown> {
    const timeout = RateLimiter.getConfig().mpApiTimeout;

    return Promise.race([
      merchantOrderClient.get({ merchantOrderId }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("MP API timeout")), timeout)
      ),
    ]);
  }

  /**
   * Validates Mercado Pago ID format with security constraints
   */
  private static isValidMercadoPagoId(resourceId: string): boolean {
    // Validar que sea numérico y tenga longitud razonable
    const isValid =
      /^\d+$/.test(resourceId) &&
      resourceId.length >= 6 &&
      resourceId.length <= 20;

    // Prevenir IDs sospechosos (demasiado grandes o patrones extraños)
    if (isValid) {
      const idNum = Number.parseInt(resourceId, 10);
      // Rechazar IDs que parezcan de prueba o maliciosos
      if (idNum < 100000 || idNum > 999999999999) {
        return false;
      }
    }

    return isValid;
  }

  /**
   * Validates UUID format strictly
   */
  private static isValidUUID(uuid: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Utility sleep function
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
