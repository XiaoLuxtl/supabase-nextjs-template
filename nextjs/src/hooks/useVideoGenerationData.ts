import { useState, useEffect, useMemo } from "react";
// Importamos solo createSPAClient, que devuelve el cliente Supabase base
import { createSPAClient } from "@/lib/supabase/client"; 
import { VideoGeneration } from "@/types/database.types";
import { useGlobal } from "@/lib/context/GlobalContext";

/**
 * Custom hook para manejar la carga inicial de videos, la lógica de autenticación 
 * y la suscripción en tiempo real a la tabla 'video_generations' de Supabase.
 * * @param selectedVideo State value del video actualmente seleccionado
 * @param setSelectedVideo State setter para actualizar el video seleccionado
 */
export function useVideoGenerationData(
    selectedVideo: VideoGeneration | null,
    setSelectedVideo: React.Dispatch<React.SetStateAction<VideoGeneration | null>>
) {
  const { user, loading: globalLoading } = useGlobal();
  const [videos, setVideos] = useState<VideoGeneration[]>([]);
  const [loading, setLoading] = useState(true);

  // Inicializamos el cliente Supabase una sola vez.
  // CORRECCIÓN: createSPAClient() ya devuelve el cliente Supabase base, no el wrapper.
  const supabase = useMemo(() => createSPAClient(), []);

  useEffect(() => {
    let videoSubscription: ReturnType<typeof supabase.channel> | null = null;

    async function initializeUserData() {
      try {
        if (globalLoading) {
          return;
        }

        // Redirigir si no hay usuario después de cargar (replicando la lógica original)
        if (!user) {
          window.location.href = "/auth/login";
          return;
        }
        
        // --- 1. Cargar videos iniciales ---
        const { data: videosData } = await supabase
          .from("video_generations")
          .select("*")
          .eq("user_id", user.id)
          .in("status", ["completed", "pending"])
          .order("created_at", { ascending: false })
          .limit(20);

        if (videosData) {
          setVideos(videosData as VideoGeneration[]);
          // Seleccionar el primer video solo si no hay uno seleccionado previamente
          if (!selectedVideo && videosData.length > 0) {
            setSelectedVideo(videosData[0] as VideoGeneration);
          }
        }

        // --- 2. Suscribirse a cambios en los videos ---
        videoSubscription = supabase
          .channel("video_updates")
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "video_generations",
              filter: `user_id=eq.${user.id}`,
            },
            (payload) => {
              console.log("Video update:", payload);
              const updatedVideo = payload.new as VideoGeneration;

              setVideos((prevVideos) => {
                const videoExists = prevVideos.some((v) => v.id === updatedVideo.id);
                if (videoExists) {
                  // Actualiza el video existente
                  return prevVideos.map((video) =>
                    video.id === updatedVideo.id
                      ? { ...video, ...updatedVideo }
                      : video
                  );
                } else {
                  // Si no existe, lo agrega al inicio (nuevo video en proceso)
                  return [updatedVideo, ...prevVideos];
                }
              });

              // Si el video que estaba seleccionado se actualiza, actualizarlo
              setSelectedVideo((current) => {
                if (current?.id === updatedVideo.id) {
                  return { ...current, ...updatedVideo };
                }
                // Si el video acaba de completarse y no hay nada seleccionado, seleccionarlo
                if (updatedVideo.status === "completed" && !current) { 
                  return { ...updatedVideo };
                }
                return current;
              });
            }
          )
          .subscribe();
      } catch (err) {
        console.error("Error loading user data:", err);
      } finally {
        setLoading(false);
      }
    }

    // Llamar a la función solo si el contexto global ha terminado de cargar
    if (!globalLoading) {
      initializeUserData();
    }
    

    return () => {
      // Limpieza de la suscripción al desmontar o cambiar dependencias
      if (videoSubscription) {
        supabase.removeChannel(videoSubscription);
      }
    };
    // Dependencias ajustadas para el hook. Se añadió supabase al array de dependencias.
  }, [user, globalLoading, selectedVideo, setSelectedVideo, supabase]);
  
  return {
    videos,
    setVideos,
    loading,
    supabase, 
  };
}
