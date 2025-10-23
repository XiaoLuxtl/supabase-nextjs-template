// src/hooks/useVideoGeneration.ts
import { useState, useCallback } from "react";
import { User, useGlobal } from "@/lib/context/GlobalContext";
import { processImageForVidu } from "@/lib/image-processor";
import { logger } from "@/lib/utils/logger";

// Timeout para la generación de video (3 minutos)
const GENERATION_TIMEOUT = 180000;

// Función mejorada para errores
const getUserFriendlyErrorMessage = (
  errorMessage: string,
  statusCode?: number
): string => {
  // Error de timeout
  if (errorMessage.includes("AbortError") || errorMessage.includes("tiempo")) {
    return "La generación tomó demasiado tiempo. Los créditos han sido reembolsados. Por favor, intenta nuevamente.";
  }

  // Error de API Vidu
  if (errorMessage.includes("Vidu API error") || statusCode === 403) {
    return "Error en el servicio de generación de video (cuota excedida o acceso denegado). Los créditos han sido reembolsados. Por favor, intenta más tarde.";
  }

  if (errorMessage.includes("Contenido no permitido")) {
    return "La imagen contiene contenido no permitido. Por favor, usa una imagen diferente.";
  }

  if (errorMessage.includes("Créditos insuficientes")) {
    return "No tienes suficientes créditos. Compra más créditos para continuar.";
  }

  // Default message mejorado
  return `${errorMessage}.`;
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

    let controller: AbortController | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      const processed = await processImageForVidu(selectedFile);

      // Crear AbortController para timeout
      controller = new AbortController();
      timeoutId = setTimeout(() => {
        logger.warn("Generation timeout reached, aborting...");
        controller?.abort();
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

      // Limpiar timeout inmediatamente después de la respuesta
      if (timeoutId) clearTimeout(timeoutId);

      logger.info("API response received", {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText,
      });

      let data;
      try {
        const responseText = await response.text();
        logger.debug("API raw response", { responseText });
        data = responseText ? JSON.parse(responseText) : {};
        logger.debug("API parsed data", { data });
      } catch (parseError) {
        logger.error("Failed to parse API response", parseError);
        throw new Error("Respuesta inválida del servidor");
      }

      // ✅ MEJORADO: Manejar tanto response.ok como data.success
      if (!response.ok || (data && !data.success)) {
        logger.warn("API returned error", {
          status: response.status,
          data,
          ok: response.ok,
        });

        const errorMessage =
          data?.error || response.statusText || `Error HTTP ${response.status}`;

        // Refrescar balance y videos inmediatamente
        await refreshCreditsBalance();
        if (refreshVideos) {
          await refreshVideos();
        }

        // Mensaje de error con status code
        const userFriendlyMessage = getUserFriendlyErrorMessage(
          errorMessage,
          response.status
        );
        setError(userFriendlyMessage);
        throw new Error(userFriendlyMessage);
      }

      // ✅ ÉXITO: Limpiar formulario
      if (data.success) {
        resetImage();
        setPrompt("");
        localStorage.setItem("lastSubmission", Date.now().toString());
        logger.info("Video generation completed successfully");
      }
    } catch (err: unknown) {
      logger.error("Generate error occurred", err);

      // Refrescar balance y videos en CUALQUIER error
      await refreshCreditsBalance();
      if (refreshVideos) {
        await refreshVideos();
      }

      let errorMessage = "Error desconocido al generar video";

      if (err instanceof Error) {
        if (err.name === "AbortError") {
          errorMessage =
            "La generación tomó demasiado tiempo y fue cancelada automáticamente.";
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
      // Limpiar timeout si aún existe
      if (timeoutId) clearTimeout(timeoutId);
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
