// src/hooks/useVideoGeneration.ts
import { useState, useCallback } from "react";
import { User, useGlobal } from "@/lib/context/GlobalContext";
import { processImageForVidu } from "@/lib/image-processor";
import { logger } from "@/lib/utils/logger";

// Timeout para la generación de video (3 minutos - Vidu puede tardar hasta 2 minutos)
const GENERATION_TIMEOUT = 180000;

// Función para convertir errores técnicos en mensajes user-friendly
const getUserFriendlyErrorMessage = (errorMessage: string): string => {
  if (errorMessage.includes("Vidu API error")) {
    return "Error en el servicio de generación de video. Los créditos han sido reembolsados. Por favor, intenta nuevamente en unos minutos.";
  }
  if (errorMessage.includes("Contenido no permitido")) {
    return "La imagen contiene contenido no permitido. Por favor, usa una imagen diferente.";
  }
  if (errorMessage.includes("Créditos insuficientes")) {
    return "No tienes suficientes créditos. Compra más créditos para continuar.";
  }
  if (errorMessage.includes("Error al consumir crédito")) {
    return "Error al procesar el pago. Por favor, intenta nuevamente.";
  }
  if (errorMessage.includes("failsafe activado")) {
    return "Error de validación interna. Los créditos han sido reembolsados. Por favor, contacta soporte.";
  }

  // Default message
  return "Error al generar el video. Por favor, intenta nuevamente o contacta soporte si el problema persiste.";
};

interface UseVideoGenerationProps {
  user: User | null;
  selectedFile: File | null;
  preview: string | null;
  prompt: string;
  resetImage: () => void;
  setPrompt: React.Dispatch<React.SetStateAction<string>>;
  refreshVideos?: () => Promise<void>; // Para refrescar lista de videos en errores inmediatos
}

export function useVideoGeneration({
  user,
  selectedFile,
  prompt,
  resetImage,
  setPrompt,
  refreshVideos,
}: UseVideoGenerationProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refreshCreditsBalance } = useGlobal();

  const generateVideo = useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    // Validaciones
    if (!selectedFile) {
      setError("Por favor selecciona una imagen primero.");
      setIsGenerating(false);
      return;
    }
    if (!prompt.trim()) {
      setError("Por favor escribe una descripción.");
      setIsGenerating(false);
      return;
    }
    if (!user) {
      setError("Usuario no autenticado.");
      setIsGenerating(false);
      return;
    }

    try {
      const processed = await processImageForVidu(selectedFile);

      // Crear AbortController para timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, GENERATION_TIMEOUT);

      const response = await fetch("/api/vidu/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_base64: processed.base64,
          prompt: prompt.trim(),
          user_id: user.id,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      logger.info("API response received", {
        status: response.status,
        ok: response.ok,
      });

      let data;
      try {
        const responseText = await response.text();
        logger.debug("API raw response", { responseText });
        data = JSON.parse(responseText);
        logger.debug("API parsed data", { data });
      } catch (parseError) {
        logger.error("Failed to parse API response", parseError);
        throw new Error("Respuesta inválida del servidor");
      }

      if (!response.ok || (data && !data.success)) {
        logger.warn("API returned error", {
          status: response.status,
          data,
        });
        const errorMessage =
          data?.error || "Error desconocido al generar video";
        // Refrescar balance de créditos (créditos reembolsados)
        await refreshCreditsBalance();
        // Refrescar lista de videos inmediatamente para mostrar estado fallido
        if (refreshVideos) {
          await refreshVideos();
        }
        // Mostrar mensaje de error mejorado
        const userFriendlyMessage = getUserFriendlyErrorMessage(errorMessage);
        setError(userFriendlyMessage);
        throw new Error(userFriendlyMessage);
      }

      // ✅ NO actualizar manualmente - el API ya devuelve créditos actualizados
      // El GlobalContext se actualiza automáticamente via suscripción en tiempo real

      // Limpiar formulario solo si fue exitoso
      if (data.success) {
        resetImage();
        setPrompt("");
        localStorage.setItem("lastSubmission", Date.now().toString());
        logger.info("Video generation completed, credits updated");
      } else {
        logger.warn("Video generation failed but credits were consumed");
      }
    } catch (err: unknown) {
      logger.error("Generate error occurred", err);

      // Refrescar balance de créditos en caso de error (créditos reembolsados)
      await refreshCreditsBalance();
      // Refrescar lista de videos inmediatamente para mostrar estado fallido
      if (refreshVideos) {
        await refreshVideos();
      }

      let errorMessage = "Error desconocido al generar video";
      if (err instanceof Error) {
        if (err.name === "AbortError") {
          errorMessage =
            "La generación tomó demasiado tiempo. Por favor, intenta nuevamente.";
        } else {
          errorMessage = err.message;
        }
      } else if (typeof err === "string") {
        errorMessage = err;
      }

      // Convertir a mensaje user-friendly
      const userFriendlyMessage = getUserFriendlyErrorMessage(errorMessage);
      setError(userFriendlyMessage);
    } finally {
      setIsGenerating(false);
    }
  }, [
    selectedFile,
    prompt,
    user,
    resetImage,
    setPrompt,
    refreshCreditsBalance,
    refreshVideos,
  ]);

  return {
    isGenerating,
    error,
    generateVideo,
  };
}
