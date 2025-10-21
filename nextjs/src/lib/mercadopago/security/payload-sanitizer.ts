export class PayloadSanitizer {
  static sanitizeWebhookPayload(payload: unknown): unknown {
    if (!payload || typeof payload !== "object") {
      return payload;
    }

    const safePayload: Record<string, unknown> = {};
    const payloadObj = payload as Record<string, unknown>;

    // Solo permitir campos esperados
    const allowedFields = ["id", "type", "topic", "resource", "data", "action"];

    allowedFields.forEach((field) => {
      if (field in payloadObj) {
        const value = payloadObj[field];
        safePayload[field] = this.sanitizeValue(value);
      }
    });

    return safePayload;
  }

  private static sanitizeValue(value: unknown): unknown {
    if (typeof value === "string") {
      return value.substring(0, 500); // Limitar tamaño
    }

    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "object" && value !== null) {
      // Deep clone para prevenir prototype pollution
      return JSON.parse(JSON.stringify(value));
    }

    return value;
  }

  static isValidWebhookSize(rawBody: string): boolean {
    const config = {
      maxWebhookSize: 1024 * 10, // 10KB
    };

    return rawBody.length <= config.maxWebhookSize;
  }
}
