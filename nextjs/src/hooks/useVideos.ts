// src/hooks/useVideos.ts - FUENTE ÚNICA DE VERDAD PARA VIDEOS
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createSPAClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import { useGlobal } from "@/lib/context/GlobalContext";

// El tipo exacto de la tabla video_generations
type VideoGeneration = Database["public"]["Tables"]["video_generations"]["Row"];

// Tipo para el payload de Supabase
interface RealtimePayload {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Partial<VideoGeneration> | null;
  old: Partial<VideoGeneration> | null;
  schema: string;
  table: string;
}

export function useVideos() {
  const { user, loading: globalLoading } = useGlobal();
  const [videos, setVideos] = useState<VideoGeneration[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoGeneration | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createSPAClient(), []);

  // Refs para manejo de estado persistente
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null
  );
  const isMounted = useRef(true);
  const hasInitialized = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    hasInitialized.current = false;

    return () => {
      isMounted.current = false;
      if (subscriptionRef.current) {
        console.log(`Cleaning up subscription on unmount`);
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Evitar múltiples inicializaciones
    if (hasInitialized.current) return;

    async function initializeUserData() {
      try {
        if (globalLoading) return;

        if (!user) {
          console.warn("No user, redirecting to login");
          window.location.href = "/auth/login";
          return;
        }

        // Marcar como inicializado inmediatamente
        hasInitialized.current = true;

        // Verificar autenticación
        const { data: session, error: sessionError } =
          await supabase.auth.getSession();
        if (sessionError || !session.session) {
          console.error("Authentication error:", sessionError);
          window.location.href = "/auth/login";
          return;
        }

        // Carga inicial de videos
        await loadInitialVideos(user.id);

        // Configurar suscripción
        await setupRealtimeSubscription(user.id);
      } catch (err) {
        console.error("Error loading user data:", err);
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    }

    initializeUserData();
  }, [user, globalLoading]);

  const loadInitialVideos = async (userId: string) => {
    const { data: videosData, error } = await supabase
      .from("video_generations")
      .select("*")
      .eq("user_id", userId)
      .not("vidu_task_id", "is", null)
      .neq("vidu_task_id", "")
      .in("status", [
        "pending",
        "queued",
        "processing",
        "completed",
        "cancelled",
      ])
      .neq("status", "failed") // Excluir videos fallidos
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Error fetching videos:", error);
      return;
    }

    if (videosData) {
      const typedVideos = videosData as VideoGeneration[];
      setVideos(typedVideos);
      setLoading(false);

      // Solo establecer selectedVideo si no hay uno seleccionado
      setSelectedVideo((current) => {
        if (!current && typedVideos.length > 0) {
          return typedVideos[0];
        }
        return current;
      });
    }
  };

  const setupRealtimeSubscription = async (userId: string) => {
    // Limpiar suscripción existente
    if (subscriptionRef.current) {
      await supabase.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
    }

    const channelName = `video_updates:${userId}`;
    console.log(`Creating subscription for ${channelName}`);

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "video_generations",
          filter: `user_id=eq.${userId}`,
        },
        async (payload: RealtimePayload) => {
          console.log(
            "Received Supabase event:",
            payload.eventType,
            payload.new?.id
          );

          await handlePayloadEvent(payload);
        }
      )
      .subscribe((status, err) => {
        // TODO revisar este error
        console.log(`Subscription status: ${status}`, err || "");

        if (status === "SUBSCRIBED") {
          console.log(`✅ Successfully subscribed`);
        } else if (status === "CHANNEL_ERROR" || status === "CLOSED") {
          // Reintentar después de 5 segundos
          setTimeout(() => {
            if (isMounted.current && user) {
              setupRealtimeSubscription(user.id);
            }
          }, 30000);
        }
      });

    subscriptionRef.current = channel;
  };

  const handlePayloadEvent = async (payload: RealtimePayload) => {
    if (!isMounted.current) return;

    try {
      switch (payload.eventType) {
        case "INSERT": {
          const newVideo = payload.new as VideoGeneration;

          setVideos((prev) => {
            // ✅ Verificación más robusta de duplicados
            const existingVideo = prev.find((v) => v.id === newVideo.id);
            if (existingVideo) {
              console.log(
                `🛑 Video duplicado detectado y evitado: ${newVideo.id}`
              );
              return prev;
            }

            console.log(
              `✅ Nuevo video agregado via suscripción: ${newVideo.id}`
            );
            return [newVideo, ...prev];
          });

          // ✅ Solo seleccionar si no hay video seleccionado
          setSelectedVideo(
            (current: VideoGeneration | null) => current ?? newVideo
          );
          break;
        }

        case "UPDATE": {
          let updatedVideo = payload.new as VideoGeneration;

          // Si el video falló, removerlo de la lista
          if (updatedVideo.status === "failed") {
            console.log(`Removing failed video ${updatedVideo.id} from list`);
            setVideos((prev) => prev.filter((v) => v.id !== updatedVideo.id));

            // Si era el video seleccionado, deseleccionarlo
            setSelectedVideo((current: VideoGeneration | null) =>
              current?.id === updatedVideo.id ? null : current
            );
            break;
          }

          // Para estados completados, obtener datos completos
          if (
            updatedVideo.status === "completed" ||
            updatedVideo.status === "created" ||
            updatedVideo.status === "success"
          ) {
            const { data: fullVideo, error } = await supabase
              .from("video_generations")
              .select("*")
              .eq("id", updatedVideo.id)
              .single();

            if (fullVideo && !error) {
              updatedVideo = fullVideo as VideoGeneration;
            }
          }

          console.log(
            `Updating video ${updatedVideo.id} to status: ${updatedVideo.status}`
          );

          setVideos((prev) =>
            prev.map((video) =>
              video.id === updatedVideo.id
                ? { ...video, ...updatedVideo }
                : video
            )
          );

          // Actualizar selectedVideo si es el mismo
          setSelectedVideo((current: VideoGeneration | null) =>
            current?.id === updatedVideo.id
              ? { ...current, ...updatedVideo }
              : current
          );
          break;
        }

        case "DELETE": {
          const deletedId = payload.old?.id as string;
          if (!deletedId) {
            console.warn("DELETE event without id in payload.old");
            return;
          }

          setVideos((prev) => prev.filter((v) => v.id !== deletedId));

          setSelectedVideo((current: VideoGeneration | null) =>
            current?.id === deletedId ? null : current
          );
          break;
        }
      }
    } catch (error) {
      console.error("Error handling payload event:", error);
    }
  };

  const refreshVideos = useCallback(async () => {
    if (user?.id) {
      console.log("🔄 Refreshing videos list...");
      await loadInitialVideos(user.id);
    }
  }, [user?.id]);

  const selectVideo = useCallback((video: VideoGeneration | null) => {
    setSelectedVideo(video);
  }, []);

  const updateVideoInList = useCallback((updatedVideo: VideoGeneration) => {
    setVideos((current) =>
      current.map((video) =>
        video.id === updatedVideo.id ? updatedVideo : video
      )
    );
    // También actualizar selectedVideo si es el mismo
    setSelectedVideo((current) =>
      current?.id === updatedVideo.id ? updatedVideo : current
    );
  }, []);

  return {
    // Estado
    videos,
    selectedVideo,
    loading,

    // Acciones
    selectVideo,
    refreshVideos,
    updateVideoInList,
    setVideos, // Para compatibilidad temporal
  };
}
