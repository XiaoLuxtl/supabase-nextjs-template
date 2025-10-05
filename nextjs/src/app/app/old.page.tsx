// src/app/app/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import useDragScroll from "@/hooks/useDragScroll";
import { createSPAClient } from "@/lib/supabase/client";
import { processImageForVidu } from "@/lib/image-processor";
import { VideoGeneration, UserProfile } from "@/types/database.types";
import { VideoList } from "@/components/VideoList";
import { VideoGeneratorForm } from "@/components/VideoGeneratorForm";
import { VideoPlayerMain } from "@/components/VideoPlayerMain";
import { VideoPlayerMobile } from "@/components/VideoPlayerMobile";
import { ArrowDownToLine, Loader2 } from "lucide-react";

export default function VideoGeneratorUI() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoGeneration | null>(
    null
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Estados de usuario
  const [userId, setUserId] = useState<string | null>(null);
  const [credits, setCredits] = useState(0);
  const [videos, setVideos] = useState<VideoGeneration[]>([]);
  const [loading, setLoading] = useState(true);

  const sliderRef = useDragScroll();
  const supabase = createSPAClient();

  // Cargar datos del usuario y configurar suscripciones
  useEffect(() => {
    let videoSubscription: ReturnType<typeof supabase.channel> | null = null;

    async function initializeUserData() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          window.location.href = "/auth/login";
          return;
        }

        setUserId(user.id);

        // Cargar perfil inicial
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("credits_balance")
          .eq("id", user.id)
          .single<UserProfile>();

        if (profile && "credits_balance" in profile) {
          setCredits(profile.credits_balance);
        }

        // Cargar videos iniciales (Solo Completed y Pending)
        const { data: videosData, error } = await supabase
          .from("video_generations")
          .select("*")
          .eq("user_id", user.id)
          // 🔑 CAMBIO CLAVE: Filtra por una lista de estados permitidos
          .in("status", ["completed", "pending"])
          .order("created_at", { ascending: false })
          .limit(20);

        if (videosData) {
          setVideos(videosData);
          if (!selectedVideo && videosData.length > 0) {
            setSelectedVideo(videosData[0]);
          }
        }

        // Suscribirse a cambios en los videos
        videoSubscription = supabase
          .channel("video_updates")
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "video_generations",
              filter: `user_id=eq.${user.id}`,
            },
            async (payload: any) => {
              console.log("Video update:", payload);
              const updatedVideo = payload.new as VideoGeneration;

              setVideos((prevVideos) => {
                const videoExists = prevVideos.some(
                  (v) => v.id === updatedVideo.id
                );
                if (videoExists) {
                  // Actualiza el video existente
                  return prevVideos.map((video) =>
                    video.id === updatedVideo.id
                      ? { ...video, ...updatedVideo }
                      : video
                  );
                } else {
                  // Si no existe, lo agrega al inicio
                  return [updatedVideo, ...prevVideos];
                }
              });

              // Si el video acaba de pasar a 'completed', seleccionarlo automáticamente
              setSelectedVideo((current) => {
                if (current?.id === updatedVideo.id) {
                  return { ...current, ...updatedVideo };
                }
                if (updatedVideo.status === "completed") {
                  return { ...updatedVideo };
                }
                return current;
              });
            }
          )
          .subscribe();

        // Suscribirse a cambios en el perfil (créditos)
        supabase
          .channel("profile_updates")
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "user_profiles",
              filter: `id=eq.${user.id}`,
            },
            (payload: any) => {
              const updatedProfile = payload.new as UserProfile;
              if ("credits_balance" in updatedProfile) {
                setCredits(updatedProfile.credits_balance);
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.error("Error loading user data:", err);
      } finally {
        setLoading(false);
      }
    }

    initializeUserData();

    return () => {
      if (videoSubscription) {
        supabase.removeChannel(videoSubscription);
      }
    };
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
    maxSize: 20 * 1024 * 1024,
    multiple: false,
    onDrop: async (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setError(null);
      setSelectedFile(file);

      try {
        const processed = await processImageForVidu(file);
        setPreview(processed.dataUrl);
      } catch (err: any) {
        setError(err.message);
        setSelectedFile(null);
      }
    },
  });

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function handleGenerateClick() {
    if (!selectedFile && !prompt.trim()) {
      setError("Por favor selecciona una imagen y escribe una descripción.");
      return;
    }
    if (!selectedFile) {
      setError("Por favor selecciona una imagen primero.");
      return;
    }
    if (!prompt.trim()) {
      setError("Por favor escribe una descripción.");
      return;
    }
    if (!userId) {
      setError("No se ha detectado usuario. Intenta recargar la página.");
      return;
    }
    if (credits < 1) {
      setError("No tienes créditos suficientes");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Procesar imagen (solo para obtener el base64)
      const processed = await processImageForVidu(selectedFile!); // Usamos ! porque ya validamos selectedFile

      // Llamar al API
      const response = await fetch("/api/vidu/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: processed.base64,
          prompt: prompt.trim(), // ⬅️ Enviamos el prompt original
          user_id: userId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al generar video");
      }

      // 🔑 CAPTURAR EL PROMPT REFINADO DEL API
      const finalPrompt = data.refined_prompt || prompt.trim();

      // Crear placeholder para el nuevo video
      const newVideo: VideoGeneration = {
        id: data.generation_id, // Usar generation_id
        user_id: userId!,
        prompt: finalPrompt, // ⬅️ USAR EL PROMPT REFINADO
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

      // ... (Resto de la lógica de actualización de estados)
      setVideos((prev) => [newVideo, ...prev]);
      setSelectedVideo(newVideo);

      // Limpiar formulario
      setSelectedFile(null);
      setPreview(null);
      setPrompt("");
    } catch (err: any) {
      console.error("Generate error:", err);
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  }

  const handleDownload = () => {
    if (selectedVideo?.video_url) {
      window.open(selectedVideo.video_url, "_blank");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <Loader2 className="h-12 w-12 text-pink-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      {/* Video móvil fixed top */}
      <VideoPlayerMobile selectedVideo={selectedVideo} />

      {/* Contenedor principal */}
      <div className="max-w-7xl mx-auto p-4 pt-[calc(33.33vh+4rem)] lg:p-8 lg:pt-24 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Columna izquierda: Controles */}
        <div className="lg:col-span-1">
          <VideoGeneratorForm
            isGenerating={isGenerating}
            credits={credits}
            error={error}
            selectedFile={selectedFile}
            preview={preview}
            prompt={prompt}
            onPromptChange={setPrompt}
            onImageChange={(file, previewUrl) => {
              setSelectedFile(file);
              setPreview(previewUrl);
            }}
            onGenerate={handleGenerateClick}
          />
        </div>

        {/* Columna derecha */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header desktop */}
          <div className="hidden lg:flex justify-between items-center pb-2 border-b border-zinc-800">
            <div className="text-sm font-semibold">
              {selectedVideo && (
                <>
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      selectedVideo.status === "completed"
                        ? "bg-emerald-600/30 text-emerald-400"
                        : selectedVideo.status === "processing"
                        ? "bg-yellow-600/30 text-yellow-400"
                        : "bg-pink-600/30 text-pink-400"
                    }`}
                  >
                    {selectedVideo.status === "completed"
                      ? "Listo"
                      : selectedVideo.status === "processing"
                      ? "Procesando"
                      : "Pendiente"}
                  </span>
                  <span className="ml-4 text-zinc-400">
                    {new Date(selectedVideo.created_at).toLocaleDateString()}
                  </span>
                </>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleDownload}
                disabled={!selectedVideo?.video_url}
                className="px-4 py-2 rounded-lg bg-pink-500 text-white font-semibold hover:bg-pink-400 transition-colors flex items-center space-x-2 disabled:opacity-50"
              >
                <ArrowDownToLine className="h-5 w-5" />
                <span>Descargar</span>
              </button>
            </div>
          </div>

          {/* Prompt desktop */}
          {selectedVideo && (
            <div className="hidden lg:block text-zinc-400 text-sm italic border-l-4 border-emerald-500 pl-3">
              <strong>Prompt:</strong> {selectedVideo.prompt}
            </div>
          )}

          {/* Video player desktop */}
          <VideoPlayerMain selectedVideo={selectedVideo} />

          {/* Slider de videos */}
          <VideoList
            videos={videos}
            selectedVideo={selectedVideo}
            onSelectVideo={setSelectedVideo}
            sliderRef={sliderRef}
          />
        </div>
      </div>
    </div>
  );
}
