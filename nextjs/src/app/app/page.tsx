"use client";

import React, { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import useDragScroll from "@/hooks/useDragScroll";
import { createSPAClient } from "@/lib/supabase/client";
import { processImageForVidu } from "@/lib/image-processor";
import { VideoGeneration, UserProfile } from "@/types/database.types";
import { VideoList } from "@/components/VideoList";
import Link from "next/link";
import {
  Upload,
  ArrowDownToLine,
  Share2,
  DollarSign,
  Loader2,
  Image as ImageIcon,
  AlertCircle,
} from "lucide-react";

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
          .single();

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

              // Asegurarse de que el video existe en nuestro estado antes de actualizarlo
              setVideos((prevVideos) => {
                const videoExists = prevVideos.some(
                  (v) => v.id === updatedVideo.id
                );
                if (!videoExists) return prevVideos;

                return prevVideos.map((video) =>
                  video.id === updatedVideo.id
                    ? { ...video, ...updatedVideo }
                    : video
                );
              });

              // Actualizar selectedVideo si es el que cambió
              setSelectedVideo((current) =>
                current?.id === updatedVideo.id
                  ? { ...current, ...updatedVideo }
                  : current
              );
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
    if (!selectedFile || !userId) {
      setError("Por favor selecciona una imagen primero");
      return;
    }

    if (credits < 1) {
      setError("No tienes créditos suficientes");
      return;
    }

    if (!prompt.trim()) {
      setError("Por favor escribe una descripción");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Procesar imagen
      const processed = await processImageForVidu(selectedFile);

      // Llamar al API
      const response = await fetch("/api/vidu/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: processed.base64,
          prompt: prompt.trim(),
          user_id: userId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al generar video");
      }

      // Crear placeholder para el nuevo video
      const newVideo: VideoGeneration = {
        id: data.videoId,
        user_id: userId,
        prompt: prompt.trim(),
        input_image_url: preview || "",
        input_image_path: null,
        model: "viduq1",
        duration: 5,
        aspect_ratio: "1:1",
        resolution: "1080p",
        vidu_task_id: data.taskId,
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

      // Actualizar la lista de videos y seleccionar el nuevo
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
      <div
        className="lg:hidden bg-zinc-800 w-full fixed top-16 left-0 z-20 shadow-2xl"
        style={{ height: "33.33vh" }}
      >
        {selectedVideo?.video_url ? (
          <video
            loop
            controls
            poster={selectedVideo.cover_url || undefined}
            className="w-full h-full"
          >
            <source
              src={selectedVideo.video_url || undefined}
              type="video/mp4"
            />
          </video>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-500">
            No hay video seleccionado
          </div>
        )}
      </div>

      {/* Contenedor principal */}
      <div className="max-w-7xl mx-auto p-4 pt-[calc(33.33vh+4rem)] lg:p-8 lg:pt-24 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Columna izquierda: Controles */}
        <div className="lg:col-span-1 space-y-6">
          <h1 className="text-3xl font-extrabold text-emerald-500">
            Imagen a Video
          </h1>

          {/* Mensaje de error */}
          {error && (
            <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`bg-zinc-800 p-6 rounded-lg border-2 ${
              isDragActive
                ? "border-emerald-500 bg-zinc-700/50"
                : "border-pink-500/80"
            } shadow-lg hover:border-pink-50 transition-all cursor-pointer h-64 flex flex-col justify-center items-center relative overflow-hidden`}
          >
            <input {...getInputProps()} />
            {preview ? (
              <>
                <img
                  src={preview}
                  alt="Preview"
                  className="absolute inset-0 w-full h-full object-cover opacity-30"
                />
                <div className="relative z-10 bg-zinc-900/80 p-4 rounded-lg">
                  <ImageIcon className="h-10 w-10 text-emerald-400 mb-3 mx-auto" />
                  <p className="text-lg font-semibold text-emerald-100">
                    Imagen seleccionada
                  </p>
                  <p className="text-sm text-zinc-400 mt-1">
                    Click para cambiar
                  </p>
                </div>
              </>
            ) : (
              <>
                <Upload
                  className={`h-10 w-10 mb-3 ${
                    isDragActive ? "text-emerald-400" : "text-pink-400"
                  }`}
                />
                <p className="text-xl font-semibold text-pink-100">
                  {isDragActive
                    ? "Suelta la imagen aquí"
                    : "Click o arrastra tu foto"}
                </p>
                <p className="text-sm text-zinc-400 mt-1">
                  (PNG, JPG o WebP - Máx 20MB)
                </p>
              </>
            )}
          </div>

          {/* Textarea prompt */}
          <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-600">
            <label
              htmlFor="description"
              className="block text-sm font-medium text-pink-100 mb-2"
            >
              Descripción del video (Prompt)
            </label>
            <textarea
              id="description"
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 text-white p-3 rounded-lg focus:border-emerald-500 focus:ring-emerald-500 resize-none placeholder-zinc-500"
              placeholder="Ej: Una mujer paseando por un jardín japonés al atardecer..."
            />
          </div>

          {/* Botón generar */}
          <button
            onClick={handleGenerateClick}
            disabled={
              isGenerating || credits === 0 || !selectedFile || !prompt.trim()
            }
            className={`w-full py-4 rounded-lg font-bold text-2xl shadow-xl transition-all flex items-center justify-center space-x-2 ${
              isGenerating || credits === 0
                ? "bg-pink-700 cursor-not-allowed opacity-75"
                : "bg-pink-500 hover:bg-pink-400 shadow-pink-500/50"
            }`}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Generando...</span>
              </>
            ) : (
              <span>Generar</span>
            )}
          </button>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-zinc-400 px-1">
            <p>
              Modelo: <span className="text-pink-300">Vidu 1.5</span>
            </p>
            <p>
              Resolución: <span className="text-pink-300">1080p</span>
            </p>
            <p>
              Duración: <span className="text-pink-300">5s</span>
            </p>
            <p>
              Costo: <span className="text-pink-300">1 crédito</span>
            </p>
          </div>

          {/* Créditos */}
          <div className="bg-zinc-800 p-4 rounded-lg flex flex-col space-y-3">
            <div className="flex justify-between items-center text-lg font-semibold">
              <span className="text-emerald-500">Créditos:</span>
              <span className="text-3xl font-extrabold text-emerald-300">
                {credits}
              </span>
            </div>
            <Link
              href="/paquetes"
              className="w-full py-3 rounded-lg font-bold text-lg bg-emerald-500 hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/50 flex items-center justify-center space-x-2"
            >
              <DollarSign className="h-5 w-5" />
              <span>Obtener más créditos</span>
            </Link>
          </div>
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
          <div className="hidden lg:block bg-zinc-800 rounded-lg shadow-2xl overflow-hidden aspect-video relative border-2 border-emerald-500">
            {selectedVideo?.video_url ? (
              <video
                controls
                loop
                preload="metadata"
                poster={selectedVideo.cover_url || undefined}
                className="w-full h-full"
              >
                <source
                  src={selectedVideo.video_url || undefined}
                  type="video/mp4"
                />
              </video>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500">
                No hay video seleccionado
              </div>
            )}
          </div>

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
