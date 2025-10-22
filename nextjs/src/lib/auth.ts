// src/lib/auth.ts
import { createSSRClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

/**
 * Resultado de autenticación
 */
export interface AuthResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
  };
  error?: string;
}

/**
 * Autentica un usuario en una API route
 * @param request - NextRequest object
 * @returns AuthResult con el usuario autenticado o error
 */
export async function authenticateUser(
  request: NextRequest
): Promise<AuthResult> {
  try {
    const supabase = await createSSRClient();

    // Obtener usuario autenticado
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      return {
        success: false,
        error: "Authentication error",
      };
    }

    if (!user) {
      return {
        success: false,
        error: "User not authenticated",
      };
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email || "",
      },
    };
  } catch (error) {
    return {
      success: false,
      error: "Internal authentication error",
    };
  }
}

/**
 * Valida que un recurso pertenezca al usuario autenticado
 * @param userId - ID del usuario autenticado
 * @param resourceUserId - ID del usuario propietario del recurso
 * @returns true si el recurso pertenece al usuario
 */
export function validateResourceOwnership(
  userId: string,
  resourceUserId: string
): boolean {
  return userId === resourceUserId;
}

/**
 * Constantes de validación
 */
export const VALIDATION_LIMITS = {
  MAX_CREDITS_PER_PURCHASE: 10000,
  MIN_CREDITS_PER_PURCHASE: 1,
  MAX_CREDITS_PER_VIDEO: 100,
  MIN_CREDITS_PER_VIDEO: 1,
  MAX_PENDING_PURCHASES: 5, // Máximo compras pendientes por usuario
} as const;
