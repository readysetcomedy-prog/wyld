// Drop-in "load more when scrolled near the end" trigger. Place after
// the last rendered row in a paginated list and pass loadMore() — the
// component auto-fires it on web via IntersectionObserver (no manual
// scroll wiring required) and renders a manual "Load more" button on
// native or when the observer isn't available.

import { useEffect, useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator, Platform, StyleSheet } from 'react-native';
import { theme } from '@/lib/theme';

export function LoadMoreSentinel({
  loading,
  hasMore,
  onLoadMore,
  label = 'Load more',
}: {
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  label?: string;
}) {
  const ref = useRef<View>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !hasMore || loading) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const node = ref.current as unknown as Element | null;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onLoadMore();
      },
      { rootMargin: '300px' }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [hasMore, loading, onLoadMore]);

  if (!hasMore && !loading) return null;
  return (
    <View ref={ref as any} style={styles.row}>
      {loading ? (
        <ActivityIndicator color={theme.colors.wyldPurple} />
      ) : (
        <Pressable style={styles.btn} onPress={onLoadMore}>
          <Text style={styles.btnText}>{label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 16, alignItems: 'center' },
  btn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  btnText: { color: theme.colors.charcoal, fontWeight: '700', fontSize: 13 },
});
