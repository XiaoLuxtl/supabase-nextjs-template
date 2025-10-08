// src/app/app/page.tsx

"use client";

import React, { useState } from "react";
import useDragScroll from "@/hooks/useDragScroll";
// Hooks funcionales
import { useVideoGenerationData } from "@/hooks/useVideoGenerationData";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useVideoGeneration } from "@/hooks/useVideoGeneration";
// Tipos y Componentes
import { VideoGeneration } from "@/types/database.types";
import VideoList from "@/components/VideoList";
import VideoGeneratorForm from "@/components/VideoGeneratorForm";
import { VideoPlayerMain } from "@/components/VideoPlayerMain";
import { VideoPlayerMobile } from "@/components/VideoPlayerMobile";
import { ArrowDownToLine, Loader2 } from "lucide-react";
import { useGlobal } from "@/lib/context/GlobalContext";

export default function VideoGeneratorUI() {
  const { user, loading: globalLoading } = useGlobal();

  // Estados esenciales de la vista
  const [selectedVideo, setSelectedVideo] = useState<VideoGeneration | null>(
    null
  );
  const [prompt, setPrompt] = useState("");

  const sliderRef = useDragScroll();

  // 1. Hook para la carga de datos (Videos y Supabase)
  const { videos, setVideos, loading } = useVideoGenerationData(
    selectedVideo,
    setSelectedVideo
  );

  // 2. Hook para la lógica de subida de imagen y Dropzone
  const {
    selectedFile,
    preview,
    uploadError,
    isDragActive,
    getRootProps,
    getInputProps,
    resetImage,
  } = useImageUpload();

  // 3. Hook para la lógica de generación
  const { isGenerating, generationError, handleGenerateClick } =
    useVideoGeneration({
      user,
      selectedFile,
      preview,
      prompt,
      setVideos, // pasado para actualizar la lista de videos
      setSelectedVideo, // pasado para seleccionar el nuevo video
      resetImage, // pasado para limpiar la imagen después de generar
      setPrompt, // pasado para limpiar el prompt después de generar
    });

  // COMBINACIÓN DE ERRORES: Muestra el error de generación o el error de subida
  const currentError = generationError || uploadError;

  const handleDownload = () => {
    if (selectedVideo?.video_url) {
      window.open(selectedVideo.video_url, "_blank");
    }
  };

  if (globalLoading || loading) {
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
            // Props de estado y manejo de eventos (ahora centralizados)
            isGenerating={isGenerating}
            credits={user?.credits_balance ?? 0}
            error={currentError} // Usamos el error combinado
            selectedFile={selectedFile}
            preview={preview}
            prompt={prompt}
            onPromptChange={setPrompt}
            onGenerate={handleGenerateClick}
            // Propiedades de Dropzone para la subida de imagen (vienen del hook)
            isDragActive={isDragActive}
            getRootProps={getRootProps}
            getInputProps={getInputProps}
            onClearImage={resetImage}
          />
        </div>

        {/* Columna derecha: Visualización de video y lista */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header desktop */}
          <div className="hidden lg:flex justify-between items-center pb-2 border-b border-zinc-800">
            <div className="text-sm font-semibold">
              {selectedVideo && (
                <>
                  {(() => {
                    // 1. Objeto de Mapeo: Asocia cada estado a su clase y texto
                    const statusMap = {
                      completed: {
                        classes: "bg-emerald-600/30 text-emerald-400",
                        text: "Listo",
                      },
                      processing: {
                        classes: "bg-yellow-600/30 text-yellow-400",
                        text: "Procesando",
                      },
                      pending: {
                        classes: "bg-yellow-600/30 text-yellow-400",
                        text: "Pendiente",
                      },
                      // Default para cualquier otro estado (ej: 'failed', 'error')
                      default: {
                        classes: "bg-pink-600/30 text-pink-400",
                        text: "Error",
                      },
                    };

                    // 2. Obtener la información. Usamos el tipo 'default' si el estado no está en el mapa.
                    // La aserción 'as keyof typeof statusMap' es necesaria para que TypeScript acepte la búsqueda por clave.
                    const statusInfo =
                      statusMap[
                        selectedVideo.status as keyof typeof statusMap
                      ] || statusMap.default;

                    return (
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${statusInfo.classes}`}
                      >
                        {statusInfo.text}
                      </span>
                    );
                  })()}
                  {/* FIN DE LA REFACTORIZACIÓN */}

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
