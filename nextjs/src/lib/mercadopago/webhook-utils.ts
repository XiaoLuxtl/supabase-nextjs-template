import { createClient } from "@supabase/supabase-js";

// Configuración centralizada
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY!
);

// Types más específicos
export type WebhookEventType = "payment" | "merchant_order" | "unknown";
export interface WebhookEvent {
  type: WebhookEventType;
  resourceId: string;
  data: unknown; // Más seguro que 'any'
}

// Constantes para evitar magic strings
const MP_EVENT_TYPES = {
  PAYMENT: "payment",
  MERCHANT_ORDER: "merchant_order",
} as const;

const MP_QUERY_PARAMS = {
  DATA_ID: "data.id",
  TYPE: "type",
  TOPIC: "topic",
  ID: "id",
} as const;

/**
 * Extrae ID numérico de URLs de Mercado Pago de forma segura
 */
function extractIdFromMercadoPagoUrl(url: unknown): string {
  if (!url) return "unknown";

  const urlString = String(url).trim();

  // Validación más robusta para IDs numéricos
  if (/^\d+$/.test(urlString)) {
    return urlString;
  }

  // Extraer ID de URLs de Mercado Pago con mejor regex
  const match = urlString.match(/\/(\d+)(?:\?|$)/); // Maneja URLs con query params
  return match ? match[1] : urlString;
}

/**
 * Construye body desde query parameters con validación
 */
export function buildBodyFromQueryParams(url: string): string {
  try {
    const searchParams = new URL(url).searchParams;
    const body: Record<string, unknown> = {};

    // Mapeo más seguro y mantenible
    const mapping: Record<string, (value: string) => void> = {
      [MP_QUERY_PARAMS.DATA_ID]: (value: string) => {
        body.id = value;
        body.data = { id: value };
      },
      [MP_QUERY_PARAMS.TYPE]: (value: string) => {
        body.type = value;
      },
      [MP_QUERY_PARAMS.TOPIC]: (value: string) => {
        body.topic = value;
      },
      [MP_QUERY_PARAMS.ID]: (value: string) => {
        body.resource = value;
        body.id = extractIdFromMercadoPagoUrl(value);
      },
    };

    // Aplicar mapeo de forma segura
    Object.entries(mapping).forEach(([param, handler]) => {
      if (searchParams.has(param)) {
        const value = searchParams.get(param);
        if (value) handler(value);
      }
    });

    console.log("🔍 Built body from query params:", body);
    return Object.keys(body).length > 0 ? JSON.stringify(body) : "";
  } catch (error) {
    console.error("❌ Error building body from query params:", error);
    return "";
  }
}

/**
 * Parsea evento de webhook con mejor validación
 */
export function parseWebhookEvent(body: unknown): WebhookEvent {
  // Validación básica del body
  if (!body || typeof body !== "object") {
    return {
      type: "unknown",
      resourceId: "invalid_body",
      data: body,
    };
  }

  const bodyObj = body as Record<string, unknown>;
  const resource = (bodyObj.resource || bodyObj.id) as string | undefined;
  const topic = (bodyObj.topic || bodyObj.action) as string | undefined;
  const eventType = bodyObj.type as string | undefined;

  const cleanResourceId = extractIdFromMercadoPagoUrl(resource);

  // Detección más robusta del tipo de evento
  if (
    topic === MP_EVENT_TYPES.PAYMENT ||
    eventType === MP_EVENT_TYPES.PAYMENT
  ) {
    const dataId =
      bodyObj.data && typeof bodyObj.data === "object"
        ? (bodyObj.data as Record<string, unknown>).id
        : undefined;

    return {
      type: MP_EVENT_TYPES.PAYMENT,
      resourceId: String(dataId || cleanResourceId),
      data: bodyObj,
    };
  }

  if (
    topic === MP_EVENT_TYPES.MERCHANT_ORDER ||
    eventType === MP_EVENT_TYPES.MERCHANT_ORDER
  ) {
    return {
      type: MP_EVENT_TYPES.MERCHANT_ORDER,
      resourceId: cleanResourceId,
      data: bodyObj,
    };
  }

  // Fallback para IDs directos
  if (
    bodyObj.id &&
    (typeof bodyObj.id === "number" || typeof bodyObj.id === "string")
  ) {
    return {
      type: MP_EVENT_TYPES.PAYMENT,
      resourceId: String(bodyObj.id),
      data: bodyObj,
    };
  }

  return {
    type: "unknown",
    resourceId: cleanResourceId || "unknown",
    data: bodyObj,
  };
}

/**
 * Log seguro de intentos de webhook con rate limiting implícito
 */
export async function logWebhookAttempt(
  paymentId: string | null,
  eventType: string,
  payload: unknown,
  signature: string | null,
  isValid: boolean,
  errorMessage?: string
): Promise<void> {
  try {
    // Limitar tamaño del payload para evitar sobrecarga
    const safePayload =
      typeof payload === "object"
        ? JSON.parse(JSON.stringify(payload)) // Deep clone para seguridad
        : payload;

    await supabase.from("mercadopago_webhook_logs").insert({
      payment_id: paymentId?.substring(0, 100), // Limitar longitud
      event_type: eventType?.substring(0, 50),
      payload: safePayload,
      signature: signature?.substring(0, 500),
      is_valid: isValid,
      error_message: errorMessage?.substring(0, 1000),
      processed: isValid && !errorMessage,
      received_at: new Date().toISOString(),
    });
  } catch (error) {
    // No throw para evitar bloquear el flujo principal
    console.error("Failed to log webhook attempt:", error);
  }
}

/**
 * Utilidad para validar estructura básica de webhook
 */
export function isValidWebhookStructure(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;

  const obj = data as Record<string, unknown>;
  return !!(obj.id || obj.resource || obj.type || obj.topic);
}
