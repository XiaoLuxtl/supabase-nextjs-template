import React from "react";
// TODO: Replace with the correct import if 'Video' exists elsewhere
// import { Video } from "@/types/database.types";

// Temporary Video type definition (replace with actual type as needed)
interface Video {
  url?: string;
  video_url?: string;
  // add other properties as needed
}
import { ArrowDownToLine, Share2 } from "lucide-react";

interface VideoPreviewProps {
  selectedVideo?: Video;
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
        <video
          controls
          poster={selectedVideo?.url}
          className="w-full h-full object-cover"
          playsInline
        >
          <source src={selectedVideo?.video_url || "#"} type="video/mp4" />
          Tu navegador no soporta el tag de video.
        </video>

        <div className="absolute top-2 right-2 flex space-x-2">
          <button
            onClick={onDownload}
            className="p-2 rounded-full bg-pink-500 text-white hover:bg-pink-400 transition-colors"
          >
            <ArrowDownToLine className="h-5 w-5" />
          </button>
          <button
            onClick={onShare}
            className="p-2 rounded-full bg-zinc-700 text-white hover:bg-zinc-600 transition-colors"
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }
);
