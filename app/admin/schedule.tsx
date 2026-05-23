// Sidebar shortcut — admins click "Schedule" here, we look up the WyLD gym
// id and forward to the full-screen /schedule/[gymId] page. Back from there
// returns to the Admin home.

import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';

export default function AdminScheduleRedirect() {
  const [wyldGymId, setWyldGymId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('gyms')
        .select('id')
        .eq('slug', 'wyld')
        .maybeSingle();
      setWyldGymId((data as any)?.id ?? null);
    })();
  }, []);

  if (wyldGymId === undefined) {
    return <View style={styles.center}><ActivityIndicator color={theme.colors.wyldPurple} /></View>;
  }
  if (!wyldGymId) {
    return (
      <View style={styles.center}>
        <Text style={styles.err}>WyLD gym row not found.</Text>
      </View>
    );
  }
  const back = encodeURIComponent('/admin');
  return <Redirect href={`/schedule/${wyldGymId}?back=${back}` as never} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  err: { color: theme.colors.danger, fontWeight: '700' },
});
