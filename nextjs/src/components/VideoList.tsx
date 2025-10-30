// src/components/VideoList.tsx
import React from "react";
import { Loader2 } from "lucide-react";
import type { Database } from "@/types/database.types";
import styles from "@/styles/video-list.module.css";

type VideoGeneration = Database["public"]["Tables"]["video_generations"]["Row"];
// ✅ Excluir null con NonNullable
type VideoStatus = NonNullable<VideoGeneration["status"]>;

interface VideoListProps {
  sliderRef: React.RefObject<HTMLDivElement | null>;
  videos: VideoGeneration[];
  selectedVideo: VideoGeneration | null;
  onSelectVideo: (video: VideoGeneration | null) => void;
}

const VideoList = function VideoList({
  sliderRef,
  videos,
  selectedVideo,
  onSelectVideo,
}: VideoListProps) {
  const statusMap: Record<
    VideoStatus,
    { classes: string; text: string; icon: React.ReactNode | null }
  > = {
    pending: {
      classes: "bg-yellow-600/30 text-yellow-400",
      text: "Pendiente",
      icon: <Loader2 className="h-5 w-5 animate-spin" />,
    },
    queued: {
      classes: "bg-yellow-600/30 text-yellow-400",
      text: "En cola",
      icon: <Loader2 className="h-5 w-5 animate-spin" />,
    },
    processing: {
      classes: "bg-yellow-600/30 text-yellow-400",
      text: "Procesando",
      icon: <Loader2 className="h-5 w-5 animate-spin" />,
    },
    completed: {
      classes: "bg-emerald-600/30 text-emerald-400",
      text: "Listo",
      icon: null,
    },
    failed: {
      classes: "bg-pink-600/30 text-pink-400",
      text: "Error",
      icon: null,
    },
    cancelled: {
      classes: "bg-pink-600/30 text-pink-400",
      text: "Cancelado",
      icon: null,
    },
  };

  return (
    <div
      ref={sliderRef}
      className={`${styles.scrollContainer} overflow-x-auto whitespace-nowrap flex gap-4 p-4 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900`}
    >
      {videos.length === 0 ? (
        <p className="text-zinc-400 text-sm italic inline-block pointer-events-none">
          No hay videos generados aún.
        </p>
      ) : (
        videos.map((video) => {
          // ✅ Type-safe con fallback para null
          const statusInfo = video.status
            ? statusMap[video.status]
            : statusMap.failed;
          const isSelected = selectedVideo?.id === video.id;

          return (
            <button
              key={video.id}
              onClick={() => {
                onSelectVideo(video);
              }}
              type="button"
              className={`${
                styles.videoItem
              } cursor-pointer p-4 border rounded-lg transition-all ${
                isSelected
                  ? "border-emerald-500 bg-zinc-800"
                  : "border-zinc-600 hover:border-emerald-500/50"
              } min-w-[200px] max-w-[200px]`}
            >
              {/* TODO Temp url */}
              {video.cover_url || "/cargando.png" ? (
                <img
                  src={video.cover_url || "/cargando.png"}
                  alt="Video cover"
                  className="w-full h-24 object-cover rounded-md mb-2 pointer-events-none"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-24 bg-zinc-700 rounded-md mb-2 flex items-center justify-center pointer-events-none">
                  <span className="text-zinc-400 text-sm">Sin imagen</span>
                </div>
              )}
              <div className="flex items-center gap-2 mb-2">
                {statusInfo.icon}
                <span
                  className={`px-2 py-1 rounded-full text-xs font-semibold ${statusInfo.classes} pointer-events-none`}
                  title={`Estado: ${statusInfo.text}`}
                >
                  {statusInfo.text}
                </span>
              </div>
              <p
                className="text-zinc-400 text-sm truncate pointer-events-none"
                title={video.prompt}
              >
                {video.prompt}
              </p>
              {video.status === "failed" && video.error_message && (
                <p
                  className="text-pink-400 text-xs mt-1 truncate pointer-events-none"
                  title={video.error_message}
                >
                  Error: {video.error_message}
                </p>
              )}
              <p className="text-zinc-500 text-xs mt-1 pointer-events-none">
                {new Date(video.created_at ?? new Date()).toLocaleDateString()}
              </p>
            </button>
          );
        })
      )}
    </div>
  );
};

export default VideoList;
