import React, { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { SystemNotification, type NotificationLevel } from '@/components/ui/SystemNotification';

export const SystemBroadcastListener = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Hidden audio element for emergency pings
    // Using a subtle high-frequency ping/chirp sound
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audioRef.current.volume = 0.4;

    const channel = supabase
      .channel('system-broadcasts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'broadcasts' }, (payload) => {
        const { id, message, level, created_at } = payload.new;
        const notificationLevel = level as NotificationLevel;
        
        // Handle Emergency Sound
        if (notificationLevel === 'emergency') {
          audioRef.current?.play().catch(e => console.log('Audio play failed:', e));
        }

        const timestamp = new Date(created_at).toLocaleTimeString('en-US', { hour12: false }) + ' UTC';

        toast.custom((t) => (
          <SystemNotification 
            id={id}
            message={message}
            level={notificationLevel}
            timestamp={timestamp}
            onDismiss={() => toast.dismiss(t)}
          />
        ), {
          id: id, // Prevent duplicate toast if server re-sends
          duration: notificationLevel === 'emergency' ? Infinity : notificationLevel === 'warning' ? 10000 : 5000,
          style: {
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
          }
        });

        // Log to console for debugging
        console.log(`[Broadcast System] Dispatching ${notificationLevel.toUpperCase()}: ${message}`);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'broadcasts' }, (payload) => {
        if (payload.old?.id) {
          toast.dismiss(payload.old.id);
          console.log(`[Broadcast System] Recalled: ${payload.old.id}`);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return null; 
};
