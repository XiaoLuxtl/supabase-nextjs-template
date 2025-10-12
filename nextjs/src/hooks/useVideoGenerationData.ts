// src/hooks/useVideoGenerationData.ts
import { useState, useEffect, useMemo, useRef } from "react";
import { createSPAClient } from "@/lib/supabase/client";
import { VideoGeneration } from "@/types/database.types";
import { useGlobal } from "@/lib/context/GlobalContext";

// Tipo para el payload de Supabase
interface RealtimePayload {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, any> | null;
  old: Record<string, any> | null;
  schema: string;
  table: string;
}

export function useVideoGenerationData(
  selectedVideo: VideoGeneration | null,
  setSelectedVideo: React.Dispatch<React.SetStateAction<VideoGeneration | null>>
) {
  const { user, loading: globalLoading } = useGlobal();
  const [videos, setVideos] = useState<VideoGeneration[]>([]);
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
  }, [user, globalLoading, supabase]);

  const loadInitialVideos = async (userId: string) => {
    const { data: videosData, error } = await supabase
      .from("video_generations")
      .select("*")
      .eq("user_id", userId)
      .gt("credits_used", 0)
      .in("status", [
        "pending",
        "queued",
        "processing",
        "completed",
        "failed",
        "cancelled",
      ])
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Error fetching videos:", error);
      return;
    }

    if (videosData) {
      const typedVideos = videosData as VideoGeneration[];
      setVideos(typedVideos);

      // Solo establecer selectedVideo si no hay uno seleccionado
      if (!selectedVideo && typedVideos.length > 0) {
        setSelectedVideo(typedVideos[0]);
      }
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
        console.log(`Subscription status: ${status}`, err || "");

        if (status === "SUBSCRIBED") {
          console.log(`✅ Successfully subscribed to ${channelName}`);
        } else if (status === "CHANNEL_ERROR" || status === "CLOSED") {
          console.error(`❌ Subscription failed for ${channelName}:`, err);
          // Reintentar después de 5 segundos
          setTimeout(() => {
            if (isMounted.current && user) {
              setupRealtimeSubscription(user.id);
            }
          }, 5000);
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
          setSelectedVideo((current) => (!current ? newVideo : current));
          break;
        }

        case "UPDATE": {
          let updatedVideo = payload.new as VideoGeneration;

          // Para estados completados o fallidos, obtener datos completos
          if (
            updatedVideo.status === "completed" ||
            updatedVideo.status === "failed"
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
          setSelectedVideo((current) =>
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

          setSelectedVideo((current) =>
            current?.id === deletedId ? null : current
          );
          break;
        }
      }
    } catch (error) {
      console.error("Error handling payload event:", error);
    }
  };

  return { videos, setVideos, loading, supabase };
}
