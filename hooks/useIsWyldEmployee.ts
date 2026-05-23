// Detects whether the current user is on the WyLD staff roster, by looking
// for a non-terminated gym_employees row at the gym with slug='wyld'.
// Used by the /member layout (to flip the "Member" sidebar role to
// "Employee") and anywhere else that needs to surface WyLD-staff-only UI.

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export function useIsWyldEmployee(): boolean | null {
  const { session, profile } = useAuth();
  const [isEmp, setIsEmp] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session?.user.id || !profile?.email) { setIsEmp(null); return; }
    let cancelled = false;
    (async () => {
      const { data: g } = await supabase
        .from('gyms')
        .select('id')
        .eq('slug', 'wyld')
        .maybeSingle();
      if (cancelled) return;
      if (!g) { setIsEmp(false); return; }
      const { data: e } = await supabase
        .from('gym_employees')
        .select('terminate_date')
        .eq('gym_id', (g as any).id)
        .or(`user_id.eq.${session.user.id},email.eq.${profile.email}`)
        .maybeSingle();
      if (cancelled) return;
      if (!e) { setIsEmp(false); return; }
      const td = (e as any).terminate_date as string | null;
      const today = new Date().toISOString().slice(0, 10);
      setIsEmp(!td || td > today);
    })();
    return () => { cancelled = true; };
  }, [session?.user.id, profile?.email]);

  return isEmp;
}
