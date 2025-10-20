// components/HomeHero.tsx

"use client";
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import AuthAwareButtons from "@/components/AuthAwareButtons";

// --------------------------------------------------------------------------------
// 1. DATOS DEL CARRUSEL Y TIPOS
// --------------------------------------------------------------------------------

interface VideoData {
  id: number;
  poster: string;
  src: string;
  preload: "auto" | "none";
  objectPosition?: string; // ✅ Nueva propiedad para controlar posición
}

const videoData: VideoData[] = [
  {
    id: 0,
    poster: "/hero/video1.jpg",
    src: "/hero/video1.mp4",
    preload: "auto",
    objectPosition: "center 30%", // ✅ Por defecto: centrado
  },
  {
    id: 1,
    poster: "/hero/video2.jpg",
    src: "/hero/video2.mp4",
    preload: "auto",
    objectPosition: "center center", // ✅ Ejemplo: 30% desde arriba
  },
  {
    id: 2,
    poster: "/hero/video3.jpg",
    src: "/hero/video3.mp4",
    preload: "none",
    objectPosition: "center center", // ✅ Ejemplo: 70% desde arriba
  },
  {
    id: 3,
    poster: "/hero/video4.jpg",
    src: "/hero/video4.mp4",
    preload: "none",
    objectPosition: "center 40%", // ✅ Ejemplo: izquierda centrado
  },
];

interface VideoItemRef {
  playFromStart: () => Promise<void>;
  pauseVideo: () => void;
  isReady: () => boolean;
}

// --------------------------------------------------------------------------------
// 2. SUB-COMPONENTE DE VIDEO (forwardRef)
// --------------------------------------------------------------------------------

interface VideoItemProps {
  data: VideoData;
  isActive: boolean;
  onVideoEnd: () => void;
  onVideoReady: (id: number) => void;
}

const VideoItem = forwardRef<VideoItemRef, VideoItemProps>(
  ({ data, isActive, onVideoEnd, onVideoReady }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isVideoReady, setIsVideoReady] = useState(false);

    useImperativeHandle(ref, () => ({
      playFromStart: async () => {
        if (!videoRef.current) return;

        try {
          videoRef.current.currentTime = 0;
          await videoRef.current.play();
        } catch (error) {
          console.log("Play interrumpido:", error);
        }
      },
      pauseVideo: () => {
        videoRef.current?.pause();
      },
      isReady: () => isVideoReady,
    }));

    // Manejar estado de preparación del video
    useEffect(() => {
      if (videoRef.current && videoRef.current.readyState >= 4) {
        setIsVideoReady(true);
        onVideoReady(data.id);
      }
    }, []);

    const handleCanPlayThrough = () => {
      setIsVideoReady(true);
      onVideoReady(data.id);
    };

    // Pausar videos inactivos y reproducir activos
    useEffect(() => {
      if (!videoRef.current) return;

      if (isActive && isVideoReady) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {
          // Ignorar errores de reproducción automática
        });
      } else if (!isActive) {
        videoRef.current.pause();
      }
    }, [isActive, isVideoReady]);

    return (
      <div
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out ${
          isActive ? "opacity-100 z-10" : "opacity-0 z-0"
        }`}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          loop={false}
          poster={data.poster}
          preload={data.preload}
          className="object-cover object-center h-full w-full block"
          style={{
            // ✅ Aplicamos la posición personalizada
            objectPosition: data.objectPosition || "center center",
          }}
          onEnded={onVideoEnd}
          onCanPlayThrough={handleCanPlayThrough}
        >
          <source src={data.src} type="video/mp4" />
        </video>
      </div>
    );
  }
);
VideoItem.displayName = "VideoItem";

// --------------------------------------------------------------------------------
// 3. COMPONENTE PRINCIPAL HOMEHERO
// --------------------------------------------------------------------------------

export default function HomeHero() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [readyStates, setReadyStates] = useState<boolean[]>(
    videoData.map((data) => data.preload === "auto")
  );

  const videoRefs = useRef<(VideoItemRef | null)[]>([]);
  const isTransitioning = useRef(false);

  const totalVideos = videoData.length;

  // Marcar video como listo
  const handleVideoReady = useCallback((id: number) => {
    setReadyStates((prev) => {
      const newStates = [...prev];
      newStates[id] = true;
      return newStates;
    });
  }, []);

  // Avanzar al siguiente video
  const nextVideo = useCallback(async () => {
    if (isTransitioning.current) return;

    isTransitioning.current = true;
    const nextIndex = (activeIndex + 1) % totalVideos;

    // Pausar video actual
    videoRefs.current[activeIndex]?.pauseVideo();

    // Si el siguiente video está listo, avanzar inmediatamente
    if (readyStates[nextIndex]) {
      setActiveIndex(nextIndex);
    } else {
      // Esperar a que el siguiente video esté listo
      const checkReady = setInterval(() => {
        if (readyStates[nextIndex] || videoRefs.current[nextIndex]?.isReady()) {
          clearInterval(checkReady);
          setActiveIndex(nextIndex);
        }
      }, 100);

      // Timeout de seguridad
      setTimeout(() => {
        clearInterval(checkReady);
        setActiveIndex(nextIndex);
      }, 5000);
    }

    // Permitir nueva transición después de un tiempo mínimo
    setTimeout(() => {
      isTransitioning.current = false;
    }, 800);
  }, [activeIndex, totalVideos, readyStates]);

  // Manejar fin de video
  const handleVideoEnd = useCallback(() => {
    nextVideo();
  }, [nextVideo]);

  // Precargar siguientes videos
  useEffect(() => {
    const nextIndex = (activeIndex + 1) % totalVideos;
    if (!readyStates[nextIndex] && videoRefs.current[nextIndex]) {
      // Forzar precarga del siguiente video
      videoRefs.current[nextIndex]?.playFromStart().then(() => {
        videoRefs.current[nextIndex]?.pauseVideo();
      });
    }
  }, [activeIndex, readyStates, totalVideos]);

  return (
    <section className="relative min-h-[100dvh] flex items-center bg-zinc-900">
      {/* -------------------- CAPAS DE FONDO -------------------- */}

      <div className="absolute inset-0 h-full w-full overflow-hidden z-0">
        {videoData.map((data, index) => (
          <VideoItem
            key={data.id}
            data={data}
            isActive={index === activeIndex}
            onVideoEnd={handleVideoEnd}
            onVideoReady={handleVideoReady}
            ref={(el: VideoItemRef | null) => {
              videoRefs.current[index] = el;
            }}
          />
        ))}

        {/* OVERLAY */}
        <div
          className="absolute inset-0 z-20 opacity-10"
          style={{
            backgroundImage: "radial-gradient(#000000 2px, transparent 0)",
            backgroundSize: "6px 6px",
          }}
        ></div>
        <div
          className="absolute inset-0 z-30"
          style={{
            background:
              "linear-gradient(to bottom, rgba(17, 24, 39, 0.3) 0%, rgba(17, 24, 39, 0.76) 100%)",
          }}
        ></div>

        {/* ✅ CAMBIO: OVERLAY DE TEXTURA (z-index: 20) */}
        {/* <div
          className="absolute inset-0 z-20 opacity-10"
          style={{
            // Usamos la URL de tu archivo de textura
            backgroundImage: "url('/hero/texture.png')",
            backgroundRepeat: "repeat", // Para asegurar que cubre todo el espacio
            backgroundSize: "auto", // Opcional: ajusta el tamaño si es necesario
          }}
        ></div> */}

        {/* OVERLAY DE GRADIENTE OSCURO (Legibilidad - z-index: 30) */}
        {/* <div
          className="absolute inset-0 z-30"
          style={{
            background:
              "linear-gradient(to bottom, rgba(17, 24, 39, 0.4) 0%, rgba(17, 24, 39, 0.9) 100%)",
          }}
        ></div> */}

        {/* -------------------- MINIATURAS DE VIDEOS -------------------- */}
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-40 flex gap-3">
          {videoData.map((data, index) => (
            <button
              key={data.id}
              onClick={() => {
                if (!isTransitioning.current) {
                  videoRefs.current[activeIndex]?.pauseVideo();
                  setActiveIndex(index);
                }
              }}
              className={`
                relative group transition-all duration-300 ease-in-out
                ${
                  index === activeIndex
                    ? "ring-2 ring-pink-500 ring-offset-2 ring-offset-zinc-900 scale-110"
                    : "opacity-70 hover:opacity-100 hover:scale-105"
                }
              `}
              aria-label={`Ir al video ${index + 1}`}
            >
              {/* Miniatura */}
              <div className="w-16 h-12 md:w-20 md:h-14 rounded-lg overflow-hidden shadow-lg">
                <img
                  src={data.poster}
                  alt={`Miniatura video ${index + 1}`}
                  className="w-full h-full object-cover"
                  style={{
                    // ✅ Aplicamos la misma posición en las miniaturas
                    objectPosition: data.objectPosition || "center center",
                  }}
                />
              </div>

              {/* Indicador de progreso para el video activo */}
              {index === activeIndex && (
                <div className="absolute -bottom-2 left-0 right-0 h-1 bg-pink-500 rounded-full">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-100"
                    style={{
                      width: "100%",
                    }}
                  />
                </div>
              )}

              {/* Tooltip en hover */}
              <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                Video {index + 1}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* -------------------- CONTENIDO PRINCIPAL -------------------- */}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-40 text-center pt-24 md:pt-32 pb-24">
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white max-w-5xl mx-auto drop-shadow-xl">
          <span className="text-pink-400">Regístrate</span> y Comienza a Generar
          Videos ¡Ya!
        </h1>

        <p className="mt-6 text-xl sm:text-2xl text-stone-50 max-w-4xl mx-auto font-light drop-shadow-xl">
          Dale vida a tus fotos en segundos. Es fácil y rápido. ¡Regístrate!
        </p>

        <div className="mt-12 flex gap-4 justify-center">
          <AuthAwareButtons primaryStyle="bg-pink-500 hover:bg-pink-400 shadow-2xl shadow-pink-500/50 text-2xl font-bold px-12 py-5 transition-transform duration-200 hover:scale-[1.02] border-2 border-white" />
        </div>
        <p className="mt-4 text-center text-sm text-stone-100 drop-shadow-lg">
          No se requiere tarjeta de crédito.
        </p>
      </div>
    </section>
  );
}
