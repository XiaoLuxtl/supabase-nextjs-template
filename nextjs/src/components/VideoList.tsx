import React from "react";
import { VideoGeneration } from "@/types/database.types";
import { Loader2 } from "lucide-react";

interface VideoListProps {
  videos: VideoGeneration[];
  selectedVideo: VideoGeneration | null;
  onSelectVideo: (video: VideoGeneration) => void;
  sliderRef: React.RefObject<HTMLDivElement>;
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
          {videos.map((video) => (
            <div
              key={video.id}
              onClick={() => onSelectVideo(video)}
              className={`flex-shrink-0 w-32 aspect-square rounded-lg overflow-hidden cursor-pointer transition-all duration-200 group relative ${
                selectedVideo?.id === video.id
                  ? "border-4 border-emerald-500 shadow-xl scale-105"
                  : "border-2 border-zinc-700 hover:border-emerald-300"
              }`}
              style={{ minWidth: "8rem" }}
            >
              <img
                src={
                  video.cover_url ||
                  "https://placehold.co/400x400?text=Processing"
                }
                alt={video.prompt}
                className={`w-full h-full object-cover transition-opacity duration-200 ${
                  video.status !== "completed" ? "opacity-50" : ""
                }`}
              />

              {/* Overlay de estado */}
              {video.status !== "completed" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 transition-opacity group-hover:opacity-100">
                  {video.status === "processing" ? (
                    <>
                      <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
                      <p className="text-xs text-emerald-200 mt-2">
                        Procesando...
                      </p>
                    </>
                  ) : video.status === "pending" ||
                    video.status === "queued" ? (
                    <>
                      <div className="h-2 w-24 bg-zinc-700 rounded-full overflow-hidden">
                        <div className="h-full w-1/2 bg-emerald-500 rounded-full animate-[progress_1s_ease-in-out_infinite]"></div>
                      </div>
                      <p className="text-xs text-emerald-200 mt-2">
                        En cola...
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-red-300">Error</p>
                  )}
                </div>
              )}

              {/* Tooltip de estado */}
              <div className="absolute top-2 right-2">
                <span
                  className={`px-2 py-1 rounded-full text-xs ${
                    video.status === "completed"
                      ? "bg-emerald-600/30 text-emerald-400"
                      : video.status === "processing"
                      ? "bg-yellow-600/30 text-yellow-400"
                      : "bg-zinc-600/30 text-zinc-400"
                  }`}
                >
                  {video.status === "completed"
                    ? "Listo"
                    : video.status === "processing"
                    ? "Procesando"
                    : video.status === "failed"
                    ? "Error"
                    : "Pendiente"}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-zinc-500 text-center py-8">
          No tienes videos generados aún
        </p>
      )}

      <style jsx global>{`
        @keyframes progress {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #3f3f46;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #27272a;
        }
      `}</style>
    </div>
  );
});
