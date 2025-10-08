import React, { useState, useCallback } from "react";
import { VideoGeneration } from "@/types/database.types";
import { User } from "@/lib/context/GlobalContext"; // Asumimos que User se define aquí
import { processImageForVidu } from "@/lib/image-processor";

// Definición de tipos para las funciones de actualización del padre
type SetVideosFunc = React.Dispatch<React.SetStateAction<VideoGeneration[]>>;
type SetSelectedVideoFunc = React.Dispatch<React.SetStateAction<VideoGeneration | null>>;
type ResetImageFunc = () => void;
type SetPromptFunc = React.Dispatch<React.SetStateAction<string>>;

interface UseVideoGenerationProps {
    user: User | null;
    selectedFile: File | null;
    preview: string | null;
    prompt: string;
    // Callbacks del componente padre para actualizar estados externos
    setVideos: SetVideosFunc;
    setSelectedVideo: SetSelectedVideoFunc;
    resetImage: ResetImageFunc;
    setPrompt: SetPromptFunc;
}

/**
 * Custom hook que maneja toda la lógica de validación y llamada al API de generación de video.
 */
export function useVideoGeneration({
    user,
    selectedFile,
    preview,
    prompt,
    setVideos,
    setSelectedVideo,
    resetImage,
    setPrompt,
}: UseVideoGenerationProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerateClick = useCallback(async () => {
        // 1. Validaciones
        if (!selectedFile) {
            setError("Por favor selecciona una imagen primero.");
            return;
        }
        if (!prompt.trim()) {
            setError("Por favor escribe una descripción.");
            return;
        }
        if (!user) {
            setError("No se ha detectado usuario. Intenta recargar la página.");
            return;
        }
        if (user.credits_balance < 1) {
            setError("No tienes créditos suficientes");
            return;
        }
        
        // Resetear error antes de empezar la generación
        setError(null); 
        setIsGenerating(true);

        try {
            // Procesar imagen para obtener el base64
            const processed = await processImageForVidu(selectedFile);

            // 2. Llamar al API
            const response = await fetch("/api/vidu/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    image_base64: processed.base64,
                    prompt: prompt.trim(),
                    user_id: user.id,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.code === "NSFW_CONTENT") {
                    setError("❌ " + data.error);
                    throw new Error("❌ " + data.error);
                }
                throw new Error(data.error || "Error al generar video");
            }

            // 3. Crear y actualizar placeholder de video
            const finalPrompt = data.refined_prompt || prompt.trim();

            const newVideo: VideoGeneration = {
                id: data.generation_id,
                user_id: user.id,
                prompt: finalPrompt,
                input_image_url: preview || "",
                input_image_path: null,
                model: "viduq1",
                duration: 5,
                aspect_ratio: "1:1",
                resolution: "1080p",
                vidu_task_id: data.vidu_task_id,
                vidu_creation_id: null,
                status: "pending",
                credits_used: 1,
                video_url: null,
                cover_url: preview,
                video_duration_actual: null,
                video_fps: null,
                bgm: false,
                error_message: null,
                error_code: null,
                retry_count: 0,
                max_retries: 3,
                vidu_full_response: null,
                created_at: new Date().toISOString(),
                started_at: null,
                completed_at: null,
            };

            setVideos((prev) => [newVideo, ...prev]);
            setSelectedVideo(newVideo);

            // 4. Limpiar estados del formulario
            resetImage(); // Limpia archivo e imagen de previsualización
            setPrompt(""); // Limpia el prompt
        } catch (err: unknown) { 
            console.error("Generate error:", err);
            let errorMessage = "Error desconocido al generar video.";
            if (err instanceof Error) {
                errorMessage = err.message;
            } else if (typeof err === 'string') {
                errorMessage = err;
            }
            setError(errorMessage);
        } finally {
            setIsGenerating(false);
        }
    }, [user, selectedFile, preview, prompt, setVideos, setSelectedVideo, resetImage, setPrompt]);

    return {
        isGenerating,
        generationError: error,
        handleGenerateClick,
    };
}
