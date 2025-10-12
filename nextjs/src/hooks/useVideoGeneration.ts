// src/hooks/useVideoGeneration.ts
import { useState, useCallback } from "react";
import { VideoGeneration } from "@/types/database.types";
import { User } from "@/lib/context/GlobalContext";
import { processImageForVidu } from "@/lib/image-processor";
import { useGlobal } from "@/lib/context/GlobalContext";

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
}

export function useVideoGeneration({
  user,
  selectedFile,
  prompt,
  resetImage,
  setPrompt,
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

      if (!response.ok) {
        const errorMessage = data.error || "Error desconocido al generar video";
        setError(errorMessage);
        throw new Error(errorMessage);
      }

      // ✅ ACTUALIZAR CRÉDITOS INMEDIATAMENTE - incluso si Vidu falla
      console.log("🔄 Actualizando créditos después de generar video...");
      await refreshUserProfile();

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
      const errorMessage =
        err instanceof Error
          ? err.message
          : typeof err === "string"
          ? err
          : "Error desconocido al generar video";
      setError(errorMessage);
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
