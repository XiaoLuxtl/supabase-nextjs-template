// src/lib/utils/logger.ts

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private readonly isDevelopment =
    process.env.NEXT_PUBLIC_NODE_ENV !== "production" &&
    process.env.NODE_ENV !== "production";
  private readonly isTest = process.env.NODE_ENV === "test";
  private get forceVerboseLogging(): boolean {
    return (
      process.env.NEXT_PUBLIC_FORCE_VERBOSE_LOGGING === "true" ||
      process.env.FORCE_VERBOSE_LOGGING === "true"
    );
  }

  /**
   * Log de desarrollo - Solo visible en desarrollo
   */
  debug(message: string, context?: LogContext) {
    if (this.isDevelopment) {
      console.log(`🐛 ${message}`, context || "");
    }
  }

  /**
   * Log informativo - Visible en desarrollo, limitado en producción
   */
  info(message: string, context?: LogContext) {
    if (this.isDevelopment || this.forceVerboseLogging) {
      console.info(`ℹ️ ${message}`, context || "");
    } else if (!this.isTest) {
      // En producción, solo logs críticos sin contexto sensible
      const safeMessage = this.sanitizeMessage(message);
      console.info(`ℹ️ ${safeMessage}`);
    }
  }

  /**
   * Log de advertencia - Siempre visible pero sanitizado
   */
  warn(message: string, context?: LogContext) {
    const safeMessage = this.sanitizeMessage(message);
    const safeContext = this.sanitizeContext(context);
    console.warn(`⚠️ ${safeMessage}`, safeContext || "");
  }

  /**
   * Log de error - Siempre visible pero sanitizado
   */
  error(message: string, error?: unknown, context?: LogContext) {
    const safeMessage = this.sanitizeMessage(message);
    const safeError = this.sanitizeError(error);
    const safeContext = this.sanitizeContext(context);
    console.error(`❌ ${safeMessage}`, safeError, safeContext || "");
  }

  /**
   * Log específico de MercadoPago - Siempre sanitizado
   */
  mercadopago(message: string, context?: LogContext) {
    const safeMessage = this.sanitizeMessage(message);
    const safeContext = this.sanitizeMercadoPagoContext(context);
    if (this.isDevelopment || this.forceVerboseLogging) {
      console.log(`💳 ${safeMessage}`, safeContext || "");
    } else {
      // En producción, logs más limitados
      console.log(`💳 ${safeMessage}`);
    }
  }

  /**
   * Log específico de autenticación - Sanitizado
   */
  auth(message: string, context?: LogContext) {
    const safeMessage = this.sanitizeMessage(message);
    const safeContext = this.sanitizeAuthContext(context);
    if (this.isDevelopment || this.forceVerboseLogging) {
      console.log(`🔐 ${safeMessage}`, safeContext || "");
    }
  }

  /**
   * Log específico de base de datos
   */
  db(message: string, context?: LogContext) {
    if (this.isDevelopment || this.forceVerboseLogging) {
      console.log(`🗄️ ${message}`, context || "");
    }
  }

  /**
   * Sanitiza mensajes para eliminar datos sensibles
   */
  private sanitizeMessage(message: string): string {
    return message.replace(/token|secret|password|key/gi, "[REDACTED]");
  }

  /**
   * Sanitiza contexto general
   */
  private sanitizeContext(context?: LogContext): LogContext | undefined {
    if (!context) return undefined;

    const sanitized: LogContext = { ...context };

    // Campos sensibles comunes
    const sensitiveFields = [
      "password",
      "token",
      "secret",
      "key",
      "authorization",
      "access_token",
      "refresh_token",
      "api_key",
      "private_key",
    ];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = "[REDACTED]";
      }
    }

    return sanitized;
  }

  /**
   * Sanitiza errores para producción
   */
  private sanitizeError(error?: unknown): unknown {
    if (!error) return undefined;

    if (this.isDevelopment) return error;

    // En producción, solo mensaje de error sanitizado
    const err = error as Error | { message?: string; name?: string };
    return {
      message: this.sanitizeMessage(err?.message || "Unknown error"),
      name: err?.name || "Error",
    };
  }

  /**
   * Sanitiza contexto específico de MercadoPago
   */
  private sanitizeMercadoPagoContext(
    context?: LogContext
  ): LogContext | undefined {
    if (!context) return undefined;

    const sanitized: LogContext = { ...context };

    // Campos sensibles de MercadoPago
    const sensitiveFields = [
      "access_token",
      "public_key",
      "secret",
      "signature",
      "x-signature",
      "authorization",
      "token",
      "card_token",
      "payment_method_id",
    ];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = "[REDACTED]";
      }
    }

    return sanitized;
  }

  /**
   * Sanitiza contexto de autenticación
   */
  private sanitizeAuthContext(context?: LogContext): LogContext | undefined {
    if (!context) return undefined;

    const sanitized: LogContext = { ...context };

    // Campos sensibles de auth
    const sensitiveFields = [
      "password",
      "token",
      "secret",
      "refresh_token",
      "access_token",
    ];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = "[REDACTED]";
      }
    }

    return sanitized;
  }
}

/**
 * Deshabilita TODOS los console methods en producción
 * para máxima seguridad y privacidad - no se muestra NADA en producción.
 *
 * Usamos NEXT_PUBLIC_NODE_ENV para que esté disponible en el cliente (navegador)
 */
const isProduction =
  process.env.NEXT_PUBLIC_NODE_ENV === "production" ||
  process.env.NODE_ENV === "production";

// Log temporal para debugging (se verá antes de la sobreescritura)
if (typeof globalThis.window !== "undefined") {
  console.log(
    "🔧 Logger inicializado en cliente. NODE_ENV:",
    process.env.NEXT_PUBLIC_NODE_ENV,
    "isProduction:",
    isProduction
  );
}

if (isProduction) {
  // Log temporal antes de sobreescribir (este SÍ se verá)
  if (typeof globalThis.window !== "undefined") {
    console.log("🚫 SOBRESCRIBIENDO CONSOLE METHODS EN PRODUCCIÓN");
  }

  // Deshabilita completamente todos los métodos de console en producción
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  // console.error = () => {};
  console.debug = () => {};
  console.trace = () => {};
  console.table = () => {};

  // Verificación final (este NO se verá si la sobreescritura funcionó)
  if (typeof globalThis.window !== "undefined") {
    console.log("✅ SOBRESCRITURA COMPLETADA - ESTE MENSAJE NO DEBERÍA VERSE");
  }
}

// Instancia global del logger
export const logger = new Logger();
