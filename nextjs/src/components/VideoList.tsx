// src/components/VideoList.tsx
"use client";

import React from "react";
import Image from "next/image"; // Import Next.js Image component
import { VideoGeneration } from "@/types/database.types";
import { Loader2 } from "lucide-react";

// Mapeo para manejar clases y textos de estado del Tooltip
const videoStatusMap = {
  completed: {
    classes: "bg-emerald-600/30 text-emerald-400",
    text: "Listo",
  },
  processing: {
    classes: "bg-yellow-600/30 text-yellow-400",
    text: "Procesando",
  },
  pending: {
    classes: "bg-zinc-600/30 text-zinc-400",
    text: "Pendiente",
  },
  queued: {
    classes: "bg-zinc-600/30 text-zinc-400",
    text: "Pendiente",
  },
  failed: {
    classes: "bg-red-600/30 text-red-400",
    text: "Error",
  },
};

// Componente para manejar el JSX del Overlay de Estado
const StatusOverlayContent: React.FC<{ status: string }> = React.memo(
  ({ status }) => {
    switch (status) {
      case "processing":
        return (
          <>
            <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
            <p className="text-xs text-emerald-200 mt-2">Procesando...</p>
          </>
        );
      case "pending":
      case "queued":
        return (
          <>
            <div className="h-2 w-24 bg-zinc-700 rounded-full overflow-hidden">
              <div className="h-full w-1/2 bg-emerald-500 rounded-full animate-[progress_1s_ease-in-out_infinite]"></div>
            </div>
            <p className="text-xs text-emerald-200 mt-2">En cola...</p>
          </>
        );
      case "failed":
      default:
        return <p className="text-xs text-red-300">Error</p>;
    }
  }
);

// Set displayName for React DevTools
StatusOverlayContent.displayName = "StatusOverlayContent";

interface VideoListProps {
  videos: VideoGeneration[];
  selectedVideo: VideoGeneration | null;
  onSelectVideo: (video: VideoGeneration) => void;
  sliderRef: React.RefObject<HTMLDivElement | null>;
}

export const VideoList = React.memo(function VideoList({
  videos,
  selectedVideo,
  onSelectVideo,
  sliderRef,
}: VideoListProps) {
  return (
    <div>
      <h3 className="text-lg font-bold text-emerald-500 mb-3">
        Videos generados ({videos.length})
      </h3>
      {videos.length > 0 ? (
        <div
          ref={sliderRef}
          className="flex space-x-4 overflow-x-auto pb-3 custom-scrollbar cursor-grab active:cursor-grabbing"
        >
          {videos.map((video) => {
            const statusInfo =
              videoStatusMap[video.status as keyof typeof videoStatusMap] ||
              videoStatusMap.pending;

            return (
              <button
                key={video.id}
                type="button"
                onClick={() => onSelectVideo(video)}
                title={`Seleccionar video: ${video.prompt}`}
                className={`flex-shrink-0 w-32 aspect-square rounded-lg overflow-hidden cursor-pointer transition-all duration-200 group relative ${
                  selectedVideo?.id === video.id
                    ? "border-4 border-emerald-500 shadow-xl scale-105"
                    : "border-2 border-zinc-700 hover:border-emerald-300"
                }`}
                style={{ minWidth: "8rem" }}
              >
                <Image
                  src={
                    video.cover_url ||
                    "https://placehold.co/400x400?text=Processing"
                  }
                  alt={video.prompt}
                  width={128} // w-32 = 128px
                  height={128} // aspect-square
                  className={`w-full h-full object-cover transition-opacity duration-200 ${
                    video.status !== "completed" ? "opacity-50" : ""
                  }`}
                />

                {/* Overlay de estado */}
                {video.status !== "completed" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 transition-opacity group-hover:opacity-100">
                    <StatusOverlayContent status={video.status} />
                  </div>
                )}

                {/* Tooltip de estado */}
                <div className="absolute top-2 right-2">
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${statusInfo.classes}`}
                  >
                    {statusInfo.text}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-zinc-500 text-center py-8">
          No tienes videos generados aún
        </p>
      )}
    </div>
  );
});

// Set displayName for React DevTools
VideoList.displayName = "VideoList";

export default VideoList;
