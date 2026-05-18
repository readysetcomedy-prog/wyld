import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Mode = 'owner' | 'member' | 'admin';

export function useUnreadMessages(mode: Mode, gymId?: string | null, userId?: string | null) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function load() {
      let q = supabase.from('message_threads').select('id, last_message_at, user_last_read_at, gym_last_read_at, admin_last_read_at, kind');
      if (mode === 'owner') {
        if (!gymId) {
          if (!cancelled) setCount(0);
          return;
        }
        q = q.eq('gym_id', gymId);
      } else if (mode === 'member') {
        if (!userId) {
          if (!cancelled) setCount(0);
          return;
        }
        q = q.eq('user_id', userId);
      } else {
        q = q.or('kind.eq.admin_user,and(kind.eq.contact_form,gym_id.is.null)');
      }
      const { data } = await q;
      if (cancelled) return;
      const readField =
        mode === 'owner' ? 'gym_last_read_at' : mode === 'admin' ? 'admin_last_read_at' : 'user_last_read_at';
      const n = (data ?? []).filter((t: any) => {
        const r = t[readField] as string | null;
        return r == null || new Date(t.last_message_at) > new Date(r);
      }).length;
      setCount(n);
    }
    load();
    timer = setInterval(load, 30000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [mode, gymId, userId]);

  return count;
}
