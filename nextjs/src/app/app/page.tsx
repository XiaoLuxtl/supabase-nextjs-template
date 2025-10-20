// src/app/app/page.tsx
"use client";

import React, { useState } from "react";
import useDragScroll from "@/hooks/useDragScroll";
import { useVideoGenerationData } from "@/hooks/useVideoGenerationData";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useVideoGeneration } from "@/hooks/useVideoGeneration";
import { VideoGeneration } from "@/types/database.types";
import VideoList from "@/components/VideoList";
import VideoGeneratorForm from "@/components/VideoGeneratorForm";
import { VideoPlayerMain } from "@/components/VideoPlayerMain";
import { VideoPlayerMobile } from "@/components/VideoPlayerMobile";
import { ArrowDownToLine, Loader2 } from "lucide-react";
import { useCredits } from "@/hooks/useCredits";
import { useGlobal } from "@/lib/context/GlobalContext";

export default function VideoGeneratorUI() {
  const { user } = useCredits();
  const { loading: authLoading, initialized } = useGlobal();
  const [selectedVideo, setSelectedVideo] = useState<VideoGeneration | null>(
    null
  );
  const [prompt, setPrompt] = useState("");

  const sliderRef = useDragScroll();

  const {
    videos,
    setVideos,
    loading: videosLoading,
    refreshVideos,
  } = useVideoGenerationData(selectedVideo, setSelectedVideo);

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
    error: generationError, // 💡 Corregido: Alias 'error' del hook a 'generationError'
    generateVideo: handleGenerateClick, // 💡 Corregido: Alias 'generateVideo' del hook a 'handleGenerateClick'
  } = useVideoGeneration({
    user,
    selectedFile,
    preview,
    prompt,
    setVideos,
    setSelectedVideo,
    resetImage,
    setPrompt,
    refreshVideos,
  });

  const currentError = generationError || uploadError;

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
          {selectedVideo && (
            <div className="hidden lg:block text-zinc-400 text-sm italic border-l-4 border-emerald-500 pl-3">
              <strong>Prompt:</strong> {selectedVideo.prompt}
            </div>
          )}
          <VideoPlayerMain selectedVideo={selectedVideo} />
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
