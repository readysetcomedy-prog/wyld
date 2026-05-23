import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Returns a map of channel_id -> unread count, plus the total. Counts only
// channels the user has posted in or been @mentioned in (per the design
// call). Polls + subscribes to message inserts to stay live.
export function useCollabUnread(userId: string | null | undefined) {
  const [byChannel, setByChannel] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!userId) {
      setByChannel({});
      return;
    }
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase.rpc('wyld_collab_my_unread');
      if (cancelled || error) return;
      const next: Record<string, number> = {};
      ((data as { channel_id: string; unread_count: number }[]) ?? []).forEach((r) => {
        if (r.unread_count > 0) next[r.channel_id] = r.unread_count;
      });
      setByChannel(next);
    }

    load();
    const channel = supabase
      .channel(`collab-unread-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wyld_collab_messages' },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wyld_collab_reads' },
        () => load()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const total = Object.values(byChannel).reduce((a, b) => a + b, 0);
  return { byChannel, total };
}
