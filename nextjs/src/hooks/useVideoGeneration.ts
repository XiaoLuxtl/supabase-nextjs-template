// src/hooks/useVideoGeneration.ts
import { useState, useCallback, useRef } from "react";
import { useCredits } from "@/hooks/useCredits";
import { processImageForVidu } from "@/lib/image-processor";
import { logger } from "@/lib/utils/logger";

// Constantes
const GENERATION_TIMEOUT = 180000; // 3 minutos
const SAFETY_TIMEOUT = 300000; // 5 minutos
const DEBOUNCE_DELAY = 1000; // 1 segundo para debounce

// Tipos
interface GenerationResult {
  success: boolean;
  videoId?: string;
  taskId?: string;
  error?: string;
}

interface UseVideoGenerationProps {
  selectedFile: File | null;
  preview: string | null;
  prompt: string;
  resetImage: () => void;
  setPrompt: React.Dispatch<React.SetStateAction<string>>;
  onSuccess?: (result: GenerationResult) => void;
  onError?: (error: string) => void;
}

// Validación mejorada
const validateInputs = (
  selectedFile: File | null,
  prompt: string,
  canAfford: boolean
): string | null => {
  if (!selectedFile) {
    return "Por favor selecciona una imagen primero.";
  }

  if (!prompt.trim()) {
    return "Por favor escribe una descripción.";
  }

  if (prompt.trim().length < 5) {
    return "La descripción debe tener al menos 5 caracteres.";
  }

  if (!canAfford) {
    return "No tienes suficientes créditos para generar el video.";
  }

  // Validación de tipo de archivo
  const validTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!validTypes.includes(selectedFile.type)) {
    return "Formato de imagen no válido. Usa JPEG, PNG o WebP.";
  }

  // Validación de tamaño (max 10MB)
  if (selectedFile.size > 10 * 1024 * 1024) {
    return "La imagen es demasiado grande. Máximo 10MB.";
  }

  return null;
};

// Procesamiento de errores mejorado
const getGenerationErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("abort") || message.includes("timeout")) {
      return "La generación tomó demasiado tiempo. Los créditos han sido reembolsados.";
    }

    if (message.includes("network") || message.includes("fetch")) {
      return "Error de conexión. Verifica tu internet e intenta nuevamente.";
    }

    if (message.includes("quota") || message.includes("403")) {
      return "Servicio temporalmente no disponible. Intenta en unos minutos.";
    }

    if (message.includes("nsfw content detected")) {
      return `Contenido inapropiado detectado: La imagen contiene contenido no permitido. Por favor, usa una imagen diferente. Tus créditos han sido reembolsados automáticamente.`;
    }

    if (message.includes("content") || message.includes("policy")) {
      return "El contenido no cumple con nuestras políticas. Usa una imagen y descripción diferentes.";
    }

    if (message.includes("credit") || message.includes("balance")) {
      return "Error al procesar los créditos. Verifica tu saldo e intenta nuevamente.";
    }

    return error.message;
  }

  return "Error inesperado. Por favor, intenta nuevamente.";
};

export function useVideoGeneration({
  selectedFile,
  prompt,
  resetImage,
  setPrompt,
  onSuccess,
  onError,
}: UseVideoGenerationProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);

  // Usar nuestra fuente única de verdad
  const { canAfford, balance, isLoading: creditsLoading } = useCredits(); // ✅ consumeCreditsForVideo removido

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastSubmissionRef = useRef<number>(0);

  // Debounce para prevenir múltiples envíos
  const canSubmit = useCallback((): boolean => {
    const now = Date.now();
    const timeSinceLastSubmit = now - lastSubmissionRef.current;

    if (timeSinceLastSubmit < DEBOUNCE_DELAY) {
      logger.warn("Submit debounced", { timeSinceLastSubmit });
      return false;
    }

    lastSubmissionRef.current = now;
    return true;
  }, []);

  // Simulación de progreso (mejora UX)
  const startProgressSimulation = useCallback(() => {
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90; // Se mantiene en 90% hasta completar
        }
        return prev + Math.random() * 15;
      });
    }, 1000);

    return interval;
  }, []);

  // Limpieza de recursos
  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Procesar respuesta de la API
  const processApiResponse = useCallback(
    async (response: Response): Promise<GenerationResult> => {
      const responseText = await response.text();
      const data = responseText ? JSON.parse(responseText) : {};

      logger.info("API response received", {
        status: response.status,
        ok: response.ok,
        hasData: !!data,
      });

      // Si la respuesta es exitosa
      if (response.ok) {
        logger.info("Generation API success", {
          videoId: data.videoId,
          taskId: data.taskId,
        });

        return {
          success: true,
          videoId: data.videoId,
          taskId: data.taskId,
        };
      }

      // 🔴 RESPUESTAS NO-OK - Manejo específico por código de estado
      logger.error("API response error", {
        status: response.status,
        statusText: response.statusText,
        error: data.error,
        code: data.code,
      });

      // Errores de cliente (4XX)
      if (response.status >= 400 && response.status < 500) {
        switch (response.status) {
          case 400:
            throw new Error(data.error || "Solicitud inválida");
          case 401:
            throw new Error(
              "Sesión expirada. Por favor, inicia sesión nuevamente."
            );
          case 402:
            throw new Error("Créditos insuficientes");
          case 403:
            throw new Error(data.error || "Acceso denegado");
          case 404:
            throw new Error("Servicio no disponible");
          case 422:
            throw new Error(data.error || "Datos de entrada inválidos");
          default:
            throw new Error(
              data.error || `Error del cliente: ${response.status}`
            );
        }
      }

      // Errores de servidor (5XX)
      if (response.status >= 500) {
        throw new Error(
          data.error ||
            "Error interno del servidor. Por favor, intenta nuevamente en unos minutos."
        );
      }

      // Error genérico
      throw new Error(
        data.error || response.statusText || `Error HTTP ${response.status}`
      );
    },
    []
  );

  // Generación principal con manejo mejorado de créditos
  const generateVideo =
    useCallback(async (): Promise<GenerationResult | null> => {
      // Validaciones iniciales
      if (!canSubmit()) {
        setError("Por favor espera antes de enviar otro video.");
        return null;
      }

      const validationError = validateInputs(
        selectedFile,
        prompt.trim(),
        canAfford(1)
      );
      if (validationError) {
        setError(validationError);
        return null;
      }

      // Configurar estado
      setIsGenerating(true);
      setError(null);
      setProgress(0);

      const progressInterval = startProgressSimulation();
      abortControllerRef.current = new AbortController();

      let safetyTimeoutId: NodeJS.Timeout;
      let generationTimeoutId: NodeJS.Timeout;

      try {
        // Setup timeouts
        safetyTimeoutId = setTimeout(() => {
          logger.error("Safety timeout reached");
          throw new Error("Tiempo de seguridad excedido");
        }, SAFETY_TIMEOUT);

        generationTimeoutId = setTimeout(() => {
          logger.warn("Generation timeout reached");
          abortControllerRef.current?.abort();
        }, GENERATION_TIMEOUT);

        // 1. Procesar imagen
        logger.info("Processing image for generation");
        const processedImage = await processImageForVidu(selectedFile!);

        // 2. Hacer request de generación
        logger.info("Sending generation request to API");
        const response = await fetch("/api/vidu/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Request-ID": `vidu-${Date.now()}-${Math.random()
              .toString(36)
              .substr(2, 9)}`,
          },
          body: JSON.stringify({
            image_base64: processedImage.base64,
            prompt: prompt.trim(),
          }),
          signal: abortControllerRef.current.signal,
        });

        // 3. Procesar respuesta (con manejo mejorado de errores)
        const result = await processApiResponse(response);

        // 4. Completar progreso y éxito
        setProgress(100);
        clearInterval(progressInterval);

        logger.info("Video generation completed successfully", {
          videoId: result.videoId,
          taskId: result.taskId,
        });

        // 5. Resetear formulario
        resetImage();
        setPrompt("");
        localStorage.setItem("lastSubmission", Date.now().toString());

        // 6. Callback de éxito
        onSuccess?.(result);

        return result;
      } catch (err) {
        // Manejo de errores unificado
        clearInterval(progressInterval);
        setProgress(0);

        // Si es un error de NSFW o error de API, usar el mensaje directamente
        const errorMessage =
          err instanceof Error &&
          (err.message.includes("NSFW content detected") ||
            err.message.includes("API"))
            ? err.message
            : getGenerationErrorMessage(err);

        // Log detallado (solo si no es NSFW para evitar logs duplicados)
        if (
          !(err instanceof Error) ||
          !err.message.includes("NSFW content detected")
        ) {
          logger.error("Generation failed with details", {
            error: err,
            userMessage: errorMessage,
            status: err instanceof Error ? "Error" : "Unknown",
          });
        }

        // Asegurar que el error se propague y se muestre
        setIsGenerating(false);
        setError(errorMessage);
        onError?.(errorMessage);

        return {
          success: false,
          error: errorMessage,
        };
      } finally {
        // Limpieza garantizada
        cleanup();
        clearTimeout(safetyTimeoutId!);
        clearTimeout(generationTimeoutId!);
        setIsGenerating(false);
      }
    }, [
      // ✅ DEPENDENCIAS CORREGIDAS - sin consumeCreditsForVideo
      selectedFile,
      prompt,
      canAfford,
      resetImage,
      setPrompt,
      onSuccess,
      onError,
      canSubmit,
      startProgressSimulation,
      processApiResponse,
      cleanup,
    ]);

  // Cancelar generación
  const cancelGeneration = useCallback(() => {
    logger.info("Generation cancelled by user");
    cleanup();
    setIsGenerating(false);
    setProgress(0);
    setError("Generación cancelada por el usuario");
  }, [cleanup]);

  // Reset error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Verificar si puede generar
  const canGenerate = useCallback((): boolean => {
    return Boolean(
      selectedFile &&
        prompt.trim().length >= 5 &&
        canAfford(1) &&
        !isGenerating &&
        !creditsLoading
    );
  }, [selectedFile, prompt, canAfford, isGenerating, creditsLoading]);

  return {
    // Estado
    isGenerating,
    error,
    progress,
    canGenerate: canGenerate(),

    // Acciones
    generateVideo,
    cancelGeneration,
    clearError,

    // Información
    balance,
    hasSufficientCredits: canAfford(1),
    isLoading: isGenerating || creditsLoading,
  };
}
