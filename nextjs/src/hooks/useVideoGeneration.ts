// src/hooks/useVideoGeneration.ts
import { useState, useCallback } from 'react';
import { VideoGeneration, ViduSuccessResponse } from '@/types/database.types';
import { User } from '@/lib/context/GlobalContext';
import { processImageForVidu } from '@/lib/image-processor';
import { createSPAClient } from '@/lib/supabase/client';

interface UseVideoGenerationProps {
  user: User | null;
  selectedFile: File | null;
  preview: string | null;
  prompt: string;
  setVideos: React.Dispatch<React.SetStateAction<VideoGeneration[]>>;
  setSelectedVideo: React.Dispatch<React.SetStateAction<VideoGeneration | null>>;
  resetImage: () => void;
  setPrompt: React.Dispatch<React.SetStateAction<string>>;
}

export function useVideoGeneration({
  user,
  selectedFile,
  prompt,
  setVideos,
  setSelectedVideo,
  resetImage,
  setPrompt,
}: UseVideoGenerationProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createSPAClient();

  const validateInputs = useCallback((): boolean => {
    if (!selectedFile) {
      setError('Por favor selecciona una imagen primero.');
      return false;
    }
    if (!prompt.trim()) {
      setError('Por favor escribe una descripción.');
      return false;
    }
    if (!user) {
      setError('No se ha detectado usuario. Intenta recargar la página.');
      return false;
    }
    if (user.credits_balance < 1) {
      setError('No tienes créditos suficientes');
      return false;
    }
    const lastSubmission = localStorage.getItem('lastSubmission');
    if (lastSubmission && Date.now() - parseInt(lastSubmission) < 5000) {
      setError('Por favor, espera 5 segundos antes de generar otro video');
      return false;
    }
    return true;
  }, [user, selectedFile, prompt]);

  const handleGenerateClick = useCallback(async () => {
    if (!validateInputs()) return;

    setIsGenerating(true);
    setError(null);

    try {
      // Procesar imagen para obtener base64
      const processed = await processImageForVidu(selectedFile!);

      // Llamar a la API de Vidu
      const response = await fetch('/api/vidu/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: processed.base64,
          prompt: prompt.trim(),
          user_id: user!.id,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        const errorMessage = data.code === 'NSFW_CONTENT' ? `Contenido NSFW detectado: ${data.error}` : data.error || 'Error al generar video';
        setError(errorMessage);
        throw new Error(errorMessage);
      }

      // Obtener el video desde Supabase
      const { data: video, error: fetchError } = await supabase
        .from('video_generations')
        .select('*')
        .eq('id', data.generation_id)
        .single();
      if (fetchError || !video) {
        console.error('Error fetching video:', JSON.stringify(fetchError, null, 2));
        setError('Error al obtener el video generado');
        return;
      }

      // Validar y castear para cumplir con VideoGeneration
      const validStatuses = ['pending', 'queued', 'processing', 'completed', 'failed', 'cancelled'] as const;
      const isValidViduResponse = (response: unknown): response is ViduSuccessResponse =>
        response != null && typeof response === 'object' && 'task_id' in response;

      const safeVideo: VideoGeneration = {
        ...video,
        translated_prompt_en: video.translated_prompt_en ?? '',
        status: validStatuses.includes(video.status as typeof validStatuses[number])
          ? video.status as VideoGeneration['status']
          : 'pending',
        vidu_full_response: isValidViduResponse(video.vidu_full_response)
          ? video.vidu_full_response as ViduSuccessResponse
          : null,
      };

      // Añadir al estado local (evitar duplicados)
      setVideos((prev) => {
        if (prev.some((v) => v.id === safeVideo.id)) {
          return prev;
        }
        return [safeVideo, ...prev];
      });
      setSelectedVideo(safeVideo);

      // Actualizar créditos localmente
      const { data: userData, error: userError } = await supabase
        .from('user_profiles')
        .select('credits_balance')
        .eq('id', user!.id)
        .single();
      if (userError || !userData) {
        console.error('Error fetching credits:', JSON.stringify(userError, null, 2));
      } else {
        user!.credits_balance = userData.credits_balance;
      }

      // Limpiar formulario
      resetImage();
      setPrompt('');
      localStorage.setItem('lastSubmission', Date.now().toString());
    } catch (err: unknown) {
      console.error('Generate error:', JSON.stringify(err, null, 2));
      const errorMessage = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Error desconocido al generar video';
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  }, [user, selectedFile, prompt, setVideos, setSelectedVideo, resetImage, setPrompt]);

  return {
    isGenerating,
    generationError: error,
    handleGenerateClick,
  };
}