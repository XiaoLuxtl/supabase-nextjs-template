// /lib/vidu/security/validationService.ts - CORREGIDO
import { CreditsService } from "@/lib/creditsService";
import { CreditValidationResult, NSFWCheckResult } from "../types/viduTypes";
import { checkNSFWContent } from "@/lib/ai-vision";

// Interface para la estructura de la request
interface VideoGenerationRequest {
  prompt: string;
  image_base64?: string;
}

// Type guard para verificar si un valor es string y no está vacío
function isValidString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export class ValidationService {
  /**
   * ✅ VALIDACIÓN SIMPLIFICADA DE CRÉDITOS
   * Usa getBalance directamente en lugar de método que no existe
   */
  static async validateUserCredits(
    userId: string
  ): Promise<CreditValidationResult> {
    try {
      const balance = await CreditsService.getBalance(userId);

      return {
        isValid: balance >= 1,
        currentBalance: balance,
        error: balance < 1 ? "Créditos insuficientes" : undefined,
      };
    } catch (error) {
      console.error("Error validating user credits:", error);
      return {
        isValid: false,
        currentBalance: 0,
        error: "Error al validar créditos",
      };
    }
  }

  static async validateImageContent(
    imageBase64: string
  ): Promise<NSFWCheckResult> {
    try {
      return await checkNSFWContent(imageBase64);
    } catch (error) {
      console.error("Error validating image content:", error);
      return {
        isNSFW: true,
        reason: "Error al validar imagen",
      };
    }
  }

  static validateRequest(request: unknown): {
    isValid: boolean;
    error?: string;
  } {
    // Verificar que es un objeto
    if (!request || typeof request !== "object") {
      return {
        isValid: false,
        error: "Request debe ser un objeto",
      };
    }

    const req = request as Record<string, unknown>;

    // Validar prompt - usar type guard
    if (!req.prompt) {
      return {
        isValid: false,
        error: "prompt es requerido",
      };
    }

    if (!isValidString(req.prompt)) {
      return {
        isValid: false,
        error: "prompt debe ser un string no vacío",
      };
    }

    // image_base64 es opcional pero si está presente debe ser string válido
    if (req.image_base64 !== undefined && req.image_base64 !== null) {
      if (!isValidString(req.image_base64)) {
        return {
          isValid: false,
          error: "image_base64 debe ser un string no vacío",
        };
      }
    }

    return { isValid: true };
  }

  // Método adicional para validar tipos específicos
  static isValidVideoGenerationRequest(
    obj: unknown
  ): obj is VideoGenerationRequest {
    if (!obj || typeof obj !== "object") return false;

    const request = obj as Record<string, unknown>;

    const hasValidPrompt = isValidString(request.prompt);
    const hasValidImage =
      request.image_base64 === undefined ||
      request.image_base64 === null ||
      isValidString(request.image_base64);

    return hasValidPrompt && hasValidImage;
  }
}
