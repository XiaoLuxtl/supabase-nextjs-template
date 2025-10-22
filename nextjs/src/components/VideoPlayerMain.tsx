// src/components/VideoPlayerMain.tsx

import React from "react";
import type { Database } from "@/types/database.types";

type VideoGeneration = Database["public"]["Tables"]["video_generations"]["Row"];

interface VideoPlayerMainProps {
  selectedVideo: VideoGeneration | null;
}

export const VideoPlayerMain: React.FC<VideoPlayerMainProps> = ({
  selectedVideo,
}) => {
  return (
    <div className="hidden lg:block bg-zinc-800 rounded-lg shadow-2xl overflow-hidden aspect-video relative border-2 border-emerald-500">
      {selectedVideo?.video_url ? (
        <video
          autoPlay
          key={selectedVideo.id}
          controls
          loop
          preload="metadata"
          poster={selectedVideo.cover_url || undefined}
          className="w-full h-full"
        >
          <source src={selectedVideo.video_url || undefined} type="video/mp4" />
        </video>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-zinc-500">
          No hay video seleccionado
        </div>
      )}
    </div>
  );
};
