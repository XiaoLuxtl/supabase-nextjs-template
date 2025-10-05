import React from "react";
import { VideoGeneration } from "@/types/database.types";

interface VideoPlayerMobileProps {
  selectedVideo: VideoGeneration | null;
}

export const VideoPlayerMobile: React.FC<VideoPlayerMobileProps> = ({
  selectedVideo,
}) => {
  return (
    <div
      className="lg:hidden bg-zinc-800 w-full fixed top-16 left-0 z-20 shadow-2xl"
      style={{ height: "33.33vh" }}
    >
      {selectedVideo?.video_url ? (
        <video
          key={selectedVideo.id}
          loop
          controls
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
