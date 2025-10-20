// src/hooks/useVideoGeneration.ts
import { useState, useCallback } from "react";
import { VideoGeneration } from "@/types/database.types";
import { User, useGlobal } from "@/lib/context/GlobalContext";
import { processImageForVidu } from "@/lib/image-processor";

// Función para convertir errores técnicos en mensajes user-friendly
const getUserFriendlyErrorMessage = (errorMessage: string): string => {
  if (errorMessage.includes("Vidu API error")) {
    return "Error al procesar el video. Los créditos han sido reembolsados. Por favor, intenta nuevamente o contacta soporte si el problema persiste.";
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
  setVideos: React.Dispatch<React.SetStateAction<VideoGeneration[]>>;
  setSelectedVideo: React.Dispatch<
    React.SetStateAction<VideoGeneration | null>
  >;
  resetImage: () => void;
  setPrompt: React.Dispatch<React.SetStateAction<string>>;
  refreshVideos: () => Promise<void>;
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
  const { refreshUserProfile } = useGlobal();

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
      });

      const data = await response.json();

      if (!response.ok || (data && !data.success)) {
        const errorMessage =
          data?.error || "Error desconocido al generar video";
        // Refrescar lista de videos para asegurar que no se muestre video fallido
        await refreshVideos();
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
        console.log("✅ Video generation completed, credits updated");
      } else {
        console.log("⚠️ Video generation failed but credits were consumed");
      }
    } catch (err: unknown) {
      console.error("Generate error:", err);

      // Refrescar lista de videos para asegurar que no se muestre video fallido
      await refreshVideos();

      let errorMessage = "Error desconocido al generar video";
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "string") {
        errorMessage = err;
      }

      // Convertir a mensaje user-friendly
      const userFriendlyMessage = getUserFriendlyErrorMessage(errorMessage);
      setError(userFriendlyMessage);
    } finally {
      setIsGenerating(false);
    }
  }, [selectedFile, prompt, user, resetImage, setPrompt, refreshUserProfile]);

  return {
    isGenerating,
    error,
    generateVideo,
  };
}
