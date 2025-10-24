// src/hooks/useVideoGeneration.ts
import { useState, useCallback } from "react";
import { User, useGlobal } from "@/lib/context/GlobalContext";
import { processImageForVidu } from "@/lib/image-processor";
import { logger } from "@/lib/utils/logger";

// Timeout para la generación de video (3 minutos)
const GENERATION_TIMEOUT = 180000;

// Función para validar inputs
const validateInputs = (
  selectedFile: File | null,
  prompt: string,
  user: User | null
): string | null => {
  if (!selectedFile) {
    return "Por favor selecciona una imagen primero.";
  }
  if (!prompt.trim()) {
    return "Por favor escribe una descripción.";
  }
  if (!user) {
    return "Usuario no autenticado.";
  }
  return null;
};

// Función para procesar respuesta de la API
const processApiResponse = async (
  response: Response,
  refreshCreditsBalance: () => Promise<void>,
  refreshVideos?: () => Promise<void>
): Promise<void> => {
  const responseText = await response.text();
  const data = responseText ? JSON.parse(responseText) : {};

  logger.info("API response received", {
    status: response.status,
    ok: response.ok,
  });
  logger.debug("API parsed data", { data });

  // Manejar errores
  if (!response.ok || !data?.success) {
    await refreshCreditsBalance();
    if (refreshVideos) await refreshVideos();

    const errorMessage =
      data?.error || response.statusText || `Error HTTP ${response.status}`;
    throw new Error(getUserFriendlyErrorMessage(errorMessage, response.status));
  }
};

// Función para setup de generación
const setupGeneration = (
  timeoutMs: number
): { controller: AbortController; timeoutId: NodeJS.Timeout } => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    logger.warn("Generation timeout reached, aborting...");
    controller.abort();
  }, timeoutMs);

  return { controller, timeoutId };
};

// Función para hacer la petición HTTP
const makeGenerationRequest = async (
  imageBase64: string,
  prompt: string,
  controller: AbortController
): Promise<Response> => {
  return fetch("/api/vidu/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_base64: imageBase64, prompt }),
    signal: controller.signal,
  });
};

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

  // Timeout de seguridad adicional (5 minutos) para forzar limpieza del estado
  const SAFETY_TIMEOUT = 300000;

  const generateVideo = useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    const safetyTimeoutId = setTimeout(() => {
      logger.error("Safety timeout - forcing cleanup");
      setIsGenerating(false);
      setError("La generación tomó demasiado tiempo. Intenta nuevamente.");
    }, SAFETY_TIMEOUT);

    try {
      const validationError = validateInputs(selectedFile, prompt.trim(), user);
      if (validationError) {
        setError(validationError);
        return;
      }

      const processed = await processImageForVidu(selectedFile!);
      const { controller, timeoutId } = setupGeneration(GENERATION_TIMEOUT);

      try {
        const response = await makeGenerationRequest(
          processed.base64,
          prompt.trim(),
          controller
        );
        clearTimeout(timeoutId);
        await processApiResponse(
          response,
          refreshCreditsBalance,
          refreshVideos
        );

        // Success
        resetImage();
        setPrompt("");
        localStorage.setItem("lastSubmission", Date.now().toString());
        logger.info("Video generation completed");
      } finally {
        clearTimeout(timeoutId);
        controller.abort();
      }
    } catch (err) {
      await handleGenerationError(err, refreshCreditsBalance, refreshVideos);
    } finally {
      clearTimeout(safetyTimeoutId);
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

  // Función auxiliar para manejar errores
  const handleGenerationError = async (
    err: unknown,
    refreshCreditsBalance: () => Promise<void>,
    refreshVideos?: () => Promise<void>
  ) => {
    logger.error("Generation error", err);

    if (!(err instanceof Error) || !err.message.includes("Error HTTP")) {
      await refreshCreditsBalance();
      if (refreshVideos) await refreshVideos();
    }

    let errorMessage = "Error desconocido";
    if (err instanceof Error) {
      errorMessage =
        err.name === "AbortError"
          ? "La generación tomó demasiado tiempo y fue cancelada."
          : err.message;
    }

    setError(getUserFriendlyErrorMessage(errorMessage));
  };

  return {
    isGenerating,
    error,
    generateVideo,
  };
}
