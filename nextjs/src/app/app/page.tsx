// src/app/app/page.tsx
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
import { ArrowDownToLine, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { useCredits } from "@/hooks/useCredits";
import { useGlobal } from "@/lib/context/GlobalContext";

const VideoGeneratorUI = React.memo(function VideoGeneratorUI() {
  const { user } = useCredits();
  const { loading: authLoading, initialized } = useGlobal();
  const [prompt, setPrompt] = useState("");
  const [timeoutReached, setTimeoutReached] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [forceRender, setForceRender] = useState(0);

  const sliderRef = useDragScroll();

  const {
    videos,
    selectedVideo,
    loading: videosLoading,
    refreshVideos,
    selectVideo,
  } = useVideos();

  // Loading combinado: autenticación + datos de videos
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
  const {
    isGenerating,
    error: generationError,
    generateVideo: handleGenerateClick,
  } = useVideoGeneration({
    user,
    selectedFile,
    preview,
    prompt,
    resetImage,
    setPrompt,
    refreshVideos,
  });

  const currentError = useMemo(
    () => generationError || uploadError,
    [generationError, uploadError]
  );

  const handleDownload = () => {
    if (selectedVideo?.video_url) {
      window.open(selectedVideo.video_url, "_blank");
    }
  };

  // Efecto para manejar timeout y verificación automática
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let intervalId: NodeJS.Timeout;

    if (loading) {
      console.log("🔄 Starting loading timeout and interval checks...");

      timeoutId = setTimeout(() => {
        console.log("⏰ Loading timeout reached, showing fallback UI");
        setTimeoutReached(true);
      }, 10000); // 10 segundos de timeout

      // Verificar cada 2 segundos si los datos han cargado
      intervalId = setInterval(() => {
        console.log("🔍 Checking loading status:", {
          authLoading,
          videosLoading,
          initialized,
          videosCount: videos?.length,
        });

        // Si ya no está loading, limpiar y forzar re-render
        if (!authLoading && (!videosLoading || videos?.length > 0)) {
          console.log("✅ Data loaded, clearing intervals and forcing render");
          clearInterval(intervalId);
          clearTimeout(timeoutId);
          setTimeoutReached(false);
          // Forzar re-render para asegurar que se muestre la UI completa
          setForceRender((prev) => prev + 1);
        }
      }, 2000);

      return () => {
        clearInterval(intervalId);
        clearTimeout(timeoutId);
      };
    }
  }, [loading, authLoading, videosLoading, initialized, videos?.length, forceRender]);

  // Efecto adicional para detectar cuando los datos se cargan después del timeout
  useEffect(() => {
    if (timeoutReached && !loading) {
      console.log("🎉 Data loaded after timeout, hiding fallback UI");
      setTimeoutReached(false);
    }
  }, [timeoutReached, loading]);

  // Función para reintentar carga completa
  const handleRetry = async () => {
    console.log("🔄 Manual retry triggered");
    setRetryCount((prev) => prev + 1);
    setTimeoutReached(false);

    try {
      // Forzar recarga de todos los datos
      await refreshVideos();

      // Esperar un momento y forzar re-render
      setTimeout(() => {
        setForceRender((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error during retry:", error);
    }
  };

  // Función para recarga completa (como F5 pero sin perder estado)
  const handleFullReload = () => {
    console.log("🔁 Full reload triggered");
    window.location.reload();
  };

  // Si ya no está loading pero estamos en timeoutReached, limpiar el estado
  if (timeoutReached && !loading) {
    console.log("🔄 Clearing timeout state since data is now loaded");
    setTimeoutReached(false);
  }

  // Pantalla de timeout - mostrar UI básica aunque no todo esté cargado
  if (timeoutReached) {
    return (
      <div className="min-h-screen bg-zinc-900 text-white">
        <div className="max-w-7xl mx-auto p-4 pt-8 lg:p-8 lg:pt-8">
          {/* Header con información de estado */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500/20 rounded-full mb-4">
              <AlertCircle className="w-8 h-8 text-amber-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Carga parcial
            </h1>
            <p className="text-amber-400 text-lg mb-4">
              Algunos elementos están tardando en cargar
            </p>

            {/* Botones principales - más prominentes */}
            <div className="flex flex-col sm:flex-row justify-center gap-4 mt-6">
              <button
                onClick={handleRetry}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
                Reintentar carga
              </button>

              <button
                onClick={handleFullReload}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
                Refrescar página completa
              </button>
            </div>

            {/* Información adicional para usuarios menos técnicos */}
            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg max-w-md mx-auto">
              <p className="text-blue-300 text-sm text-center">
                💡 <strong>Sugerencia:</strong> Si los problemas persisten, usa
                el botón `&quot;`Refrescar página completa`&quot;` para
                reiniciar la aplicación.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Formulario - siempre disponible */}
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

            {/* Área de videos con estado parcial */}
            <div className="lg:col-span-2 space-y-6">
              {/* Información de estado con botón de refrescar */}
              <div className="bg-zinc-800/50 rounded-lg p-6 border border-amber-500/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-amber-400 mb-1">
                      Estado de carga
                    </h3>
                    <p className="text-zinc-400 text-sm">
                      Si los videos no aparecen, intenta refrescar la página
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleRetry}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors text-sm"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Reintentar
                    </button>
                    <button
                      onClick={handleFullReload}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Refrescar
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Autenticación:</span>
                    <span
                      className={
                        authLoading ? "text-amber-400" : "text-emerald-400"
                      }
                    >
                      {authLoading ? "Cargando..." : "Completado"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Videos:</span>
                    <span
                      className={
                        videosLoading ? "text-amber-400" : "text-emerald-400"
                      }
                    >
                      {videosLoading
                        ? "Cargando..."
                        : `Cargados (${videos?.length || 0})`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Reintentos:</span>
                    <span className="text-zinc-400">{retryCount}</span>
                  </div>
                </div>
              </div>

              {/* Lista de videos parcial o placeholder */}
              {videos && videos.length > 0 ? (
                <>
                  <VideoPlayerMain selectedVideo={selectedVideo} />
                  <VideoList
                    sliderRef={sliderRef}
                    videos={videos}
                    selectedVideo={selectedVideo}
                    onSelectVideo={selectVideo}
                  />

                  {/* Mensaje de éxito parcial */}
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                    <p className="text-emerald-400 text-sm text-center">
                      ✅ ¡Videos cargados correctamente! Si aún ves problemas,
                      puedes usar el botón `&quot;`Refrescar página
                      completa`&quot;` arriba.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* Placeholder para el reproductor */}
                  <div className="bg-zinc-800/30 rounded-lg p-8 border border-dashed border-zinc-600 text-center">
                    <p className="text-zinc-500 mb-4">
                      Selecciona un video para reproducirlo
                    </p>
                    <button
                      onClick={handleFullReload}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Refrescar para cargar videos
                    </button>
                  </div>

                  {/* Placeholder para la lista */}
                  <div className="bg-zinc-800/30 rounded-lg p-6 border border-dashed border-zinc-600 text-center">
                    <p className="text-zinc-500 mb-4">
                      Los videos aparecerán aquí una vez cargados
                    </p>
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={handleRetry}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors text-sm"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Reintentar
                      </button>
                      <button
                        onClick={handleFullReload}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Refrescar página
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Footer con botón de refrescar adicional */}
          <div className="mt-8 text-center">
            <div className="inline-flex flex-col sm:flex-row items-center gap-4 p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
              <span className="text-zinc-400 text-sm">
                ¿Sigue sin funcionar correctamente?
              </span>
              <button
                onClick={handleFullReload}
                className="flex items-center justify-center gap-2 px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
                Refrescar página completa
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Pantalla de loading normal
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-pink-500 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Cargando aplicación...</p>
          <p className="text-zinc-400 text-sm mt-2">
            {retryCount > 0
              ? `Reintento ${retryCount}...`
              : "Preparando todo para ti"}
          </p>
          <div className="mt-4 text-xs text-zinc-500">
            <p>Si tarda mucho, continuaremos automáticamente</p>
          </div>
        </div>
      </div>
    );
  }

  // UI normal cuando todo está cargado
  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <VideoPlayerMobile selectedVideo={selectedVideo} />
      <div className="max-w-7xl mx-auto p-4 pt-[calc(33.33vh+4rem)] lg:p-8 lg:pt-24 grid grid-cols-1 lg:grid-cols-3 gap-8">
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
        <div className="lg:col-span-2 space-y-6">
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
          {selectedVideo && (
            <div className="hidden lg:block text-zinc-400 text-sm italic border-l-4 border-emerald-500 pl-3">
              <strong>Prompt:</strong> {selectedVideo.prompt}
            </div>
          )}
          <VideoPlayerMain selectedVideo={selectedVideo} />
          <VideoList
            sliderRef={sliderRef}
            videos={videos}
            selectedVideo={selectedVideo}
            onSelectVideo={selectVideo}
          />
        </div>
      </div>
    </div>
  );
});

VideoGeneratorUI.displayName = "VideoGeneratorUI";

export default VideoGeneratorUI;
