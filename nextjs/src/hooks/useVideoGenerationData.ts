// src/hooks/useVideoGenerationData.ts
import { useState, useEffect, useMemo } from 'react';
import { createSPAClient } from '@/lib/supabase/client';
import { VideoGeneration } from '@/types/database.types';
import { useGlobal } from '@/lib/context/GlobalContext';

export function useVideoGenerationData(
  selectedVideo: VideoGeneration | null,
  setSelectedVideo: React.Dispatch<React.SetStateAction<VideoGeneration | null>>
) {
  const { user, loading: globalLoading } = useGlobal();
  const [videos, setVideos] = useState<VideoGeneration[]>([]);
  const [loading, setLoading] = useState(true);

  // Inicializar cliente Supabase
  const supabase = useMemo(() => createSPAClient(), []);

  useEffect(() => {
    let videoSubscription: ReturnType<typeof supabase.channel> | null = null;

    async function initializeUserData() {
      try {
        if (globalLoading) {
          return;
        }

        if (!user) {
          window.location.href = '/auth/login';
          return;
        }

        // Cargar videos iniciales
        const { data: videosData, error } = await supabase
          .from('video_generations')
          .select('*')
          .eq('user_id', user.id)
          .in('status', ['pending', 'queued', 'processing', 'completed', 'failed', 'cancelled'])
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) {
          console.error('Error fetching videos:', JSON.stringify(error, null, 2));
        } else if (videosData) {
          setVideos(videosData as VideoGeneration[]);
          if (!selectedVideo && videosData.length > 0) {
            setSelectedVideo(videosData[0] as VideoGeneration);
          }
        }

        // Suscripción a INSERT y UPDATE
        videoSubscription = supabase
          .channel('video_updates')
          .on(
            'postgres_changes',
            {
              event: '*', // Escuchar INSERT, UPDATE, DELETE
              schema: 'public',
              table: 'video_generations',
              filter: `user_id=eq.${user.id}`,
            },
            (payload) => {
              console.log('Supabase event:', JSON.stringify(payload, null, 2));
              const updatedVideo = payload.new as VideoGeneration;

              if (payload.eventType === 'INSERT') {
                // Evitar duplicados
                setVideos((prev) => {
                  if (prev.some((v) => v.id === updatedVideo.id)) {
                    return prev;
                  }
                  return [updatedVideo, ...prev];
                });
              } else if (payload.eventType === 'UPDATE') {
                setVideos((prev) =>
                  prev.map((video) =>
                    video.id === updatedVideo.id ? { ...video, ...updatedVideo } : video
                  )
                );
              } else if (payload.eventType === 'DELETE') {
                setVideos((prev) => prev.filter((v) => v.id !== payload.old.id));
              }

              // Actualizar video seleccionado
              setSelectedVideo((current) => {
                if (current?.id === updatedVideo.id) {
                  return { ...current, ...updatedVideo };
                }
                if (updatedVideo.status === 'completed' && !current) {
                  return { ...updatedVideo };
                }
                return current;
              });
            }
          )
          .subscribe((status) => {
            console.log('Subscription status:', status);
            if (status === 'SUBSCRIBED') {
              console.log('Subscribed to video_updates channel');
            } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              console.error('Subscription error or closed:', status);
            }
          });

        // Manejo de videos atascados
        const checkStaleVideos = async () => {
          const { data } = await supabase
            .from('video_generations')
            .select('*')
            .eq('user_id', user.id)
            .in('status', ['pending', 'queued', 'processing'])
            .lt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());
          if (data?.length) {
            console.log('Stale videos:', JSON.stringify(data, null, 2));
            await supabase
              .from('video_generations')
              .update({ status: 'failed', error_message: 'Video processing timed out' })
              .in('id', data.map((v) => v.id));
          }
        };
        const interval = setInterval(checkStaleVideos, 60 * 1000);
        return () => clearInterval(interval);
      } catch (err) {
        console.error('Error loading user data:', JSON.stringify(err, null, 2));
      } finally {
        setLoading(false);
      }
    }

    if (!globalLoading) {
      initializeUserData();
    }

    return () => {
      if (videoSubscription) {
        supabase.removeChannel(videoSubscription);
      }
    };
  }, [user, globalLoading, supabase]);

  return {
    videos,
    setVideos,
    loading,
    supabase,
  };
}