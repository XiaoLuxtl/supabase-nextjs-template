// src/app/app/page.tsx - VERSIÓN SIMPLIFICADA
"use client";

import React, { useState, useMemo, useEffect } from "react";
import useDragScroll from "@/hooks/useDragScroll";
import { useVideos } from "@/hooks/useVideos";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useVideoGeneration } from "@/hooks/useVideoGeneration";
import VideoList from "@/components/VideoList";
import VideoGeneratorForm from "@/components/VideoGeneratorForm";
import { VideoPlayerMain } from "@/components/VideoPlayerMain";
import { VideoPlayerMobile } from "@/components/VideoPlayerMobile";
import { ArrowDownToLine, Loader2, RefreshCw } from "lucide-react";
import { useGlobal } from "@/lib/context/GlobalContext";

const VideoGeneratorUI = React.memo(function VideoGeneratorUI() {
  const { loading: authLoading, initialized } = useGlobal();
  const [prompt, setPrompt] = useState("");
  const [needsManualRefresh, setNeedsManualRefresh] = useState(false);

  const sliderRef = useDragScroll();

  const {
    videos,
    selectedVideo,
    loading: videosLoading,
    refreshVideos,
    selectVideo,
  } = useVideos();

  // Loading simplificado
  const loading = authLoading || (initialized && videosLoading);

  const {
    selectedFile,
    preview,
    uploadError,
    isDragActive,
    getRootProps,
    getInputProps,
    resetImage,
  } = useImageUpload();

  // ✅ CORREGIDO: Remove 'user' prop since useVideoGeneration now uses useCredits internally
  const {
    isGenerating,
    error: generationError,
    generateVideo: handleGenerateClick,
  } = useVideoGeneration({
    selectedFile,
    preview,
    prompt,
    resetImage,
    setPrompt,
  });

  const currentError = useMemo(
    () => generationError || uploadError,
    [generationError, uploadError]
  );

  // Efecto simplificado para detectar problemas de carga
  useEffect(() => {
    if (!loading && initialized && videos.length === 0) {
      // Si no hay videos pero debería haber, sugerir refresh
      const timer = setTimeout(() => {
        setNeedsManualRefresh(true);
      }, 8000); // Esperar 8 segundos antes de sugerir refresh

      return () => clearTimeout(timer);
    } else {
      setNeedsManualRefresh(false);
    }
  }, [loading, initialized, videos.length]);

  // Auto-retry en caso de error de carga
  useEffect(() => {
    if (videosLoading && initialized) {
      const timer = setTimeout(() => {
        console.log("🔄 Auto-retrying videos load...");
        handleFullReload();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [videosLoading, initialized, refreshVideos]);

  const handleDownload = () => {
    if (selectedVideo?.video_url) {
      window.open(selectedVideo.video_url, "_blank");
    }
  };

  const handleManualRefresh = async () => {
    console.log("🔄 Manual refresh triggered");
    setNeedsManualRefresh(false);
    await refreshVideos();
  };

  const handleFullReload = () => {
    console.log("🔁 Full page reload");
    window.location.reload();
  };

  // Loading state simple
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-pink-500 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Cargando aplicación...</p>
          <p className="text-zinc-400 text-sm mt-2">
            {videosLoading ? "Cargando tus videos..." : "Inicializando..."}
          </p>
        </div>
      </div>
    );
  }

  // UI principal simplificada
  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <VideoPlayerMobile selectedVideo={selectedVideo} />

      {/* Banner de refresh necesario - solo cuando es realmente necesario */}
      {needsManualRefresh && (
        <div className="bg-amber-500/10 border-b border-amber-500/20">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <RefreshCw className="h-5 w-5 text-amber-500 mr-3" />
                <p className="text-amber-400 text-sm">
                  Los videos pueden estar desactualizados
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleManualRefresh}
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-sm transition-colors"
                >
                  Actualizar
                </button>
                <button
                  onClick={handleFullReload}
                  className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm transition-colors"
                >
                  Refrescar página
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-4 pt-[calc(33.33vh+4rem)] lg:p-8 lg:pt-24 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulario */}
        <div className="lg:col-span-1">
          <VideoGeneratorForm
            isGenerating={isGenerating}
            error={currentError}
            selectedFile={selectedFile}
            preview={preview}
            prompt={prompt}
            onPromptChange={setPrompt}
            onGenerate={handleGenerateClick}
            isDragActive={isDragActive}
            getRootProps={getRootProps}
            getInputProps={getInputProps}
            onClearImage={resetImage}
          />
        </div>

        {/* Área de videos */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header con controles */}
          <div className="hidden lg:flex justify-between items-center pb-2 border-b border-zinc-800">
            <div className="text-sm font-semibold">
              {selectedVideo && (
                <>
                  {(() => {
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
                      default: {
                        classes: "bg-pink-600/30 text-pink-400",
                        text: "Error",
                      },
                    };
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
                  <span className="ml-4 text-zinc-400">
                    {new Date(
                      selectedVideo.created_at ?? new Date()
                    ).toLocaleDateString()}
                  </span>
                </>
              )}
            </div>

            <div className="flex space-x-3">
              {/* Botón de refresh estratégico */}
              {videos.length === 0 && (
                <button
                  onClick={handleManualRefresh}
                  className="flex items-center gap-2 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors text-sm"
                >
                  <RefreshCw className="h-4 w-4" />
                  Cargar videos
                </button>
              )}

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

          {/* Prompt del video seleccionado */}
          {selectedVideo && (
            <div className="hidden lg:block text-zinc-400 text-sm italic border-l-4 border-emerald-500 pl-3">
              <strong>Prompt:</strong> {selectedVideo.prompt}
            </div>
          )}

          {/* Reproductor principal */}
          <VideoPlayerMain selectedVideo={selectedVideo} />

          {/* Lista de videos con estado vacío mejorado */}
          {videos.length > 0 ? (
            <VideoList
              sliderRef={sliderRef}
              videos={videos}
              selectedVideo={selectedVideo}
              onSelectVideo={selectVideo}
            />
          ) : (
            <div className="bg-zinc-800/30 rounded-lg p-8 border border-dashed border-zinc-600 text-center">
              <div className="max-w-md mx-auto">
                <RefreshCw className="h-12 w-12 text-zinc-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-zinc-300 mb-2">
                  No hay videos aún
                </h3>
                <p className="text-zinc-500 mb-4">
                  {needsManualRefresh
                    ? "Los videos pueden estar cargando. Si no aparecen, intenta actualizar."
                    : "Genera tu primer video usando el formulario a la izquierda."}
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={handleManualRefresh}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Actualizar lista
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

VideoGeneratorUI.displayName = "VideoGeneratorUI";

export default VideoGeneratorUI;
