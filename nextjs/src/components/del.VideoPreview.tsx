// src/components/VideoPreview.tsx
"use client";

import React from "react";
import { VideoGeneration } from "@/types/database.types"; // Import correct type
import { ArrowDownToLine, Share2 } from "lucide-react";

interface VideoPreviewProps {
  selectedVideo?: VideoGeneration; // Use VideoGeneration instead of temporary Video
  onDownload: () => void;
  onShare: () => void;
}

export const VideoPreview: React.FC<VideoPreviewProps> = React.memo(
  ({ selectedVideo, onDownload, onShare }) => {
    return (
      <div
        className="lg:hidden bg-zinc-800 w-full fixed top-16 left-0 z-20 shadow-2xl"
        style={{ height: "33.33vh" }}
      >
        {selectedVideo ? (
          <video
            controls
            poster={
              selectedVideo.preview_url ||
              "https://placehold.co/400x400?text=Video"
            }
            className="w-full h-full object-cover"
            playsInline
            muted // Improves mobile autoplay compatibility
          >
            <source src={selectedVideo.video_url || "#"} type="video/mp4" />
            Tu navegador no soporta el tag de video.
          </video>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-900">
            <p className="text-zinc-500 text-sm">Selecciona un video</p>
          </div>
        )}

        {selectedVideo && (
          <div className="absolute top-2 right-2 flex space-x-2">
            <button
              onClick={onDownload}
              className="p-2 rounded-full bg-pink-500 text-white hover:bg-pink-400 transition-colors"
              aria-label="Descargar video"
            >
              <ArrowDownToLine className="h-5 w-5" />
            </button>
            <button
              onClick={onShare}
              className="p-2 rounded-full bg-zinc-700 text-white hover:bg-zinc-600 transition-colors"
              aria-label="Compartir video"
            >
              <Share2 className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    );
  }
);

// Set displayName for React DevTools
VideoPreview.displayName = "VideoPreview";

export default VideoPreview;
