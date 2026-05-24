// Generic infinite-scroll list state. Pages a fetcher in chunks of
// `pageSize` and exposes loadMore() so a parent ScrollView (or an
// IntersectionObserver) can pull the next batch when the user nears
// the end. Designed for Supabase-style `.range(from, to)` queries but
// works with anything that returns a flat array.
//
// Usage:
//   const { items, loadMore, loading, hasMore, reload } = useInfiniteList({
//     pageSize: 50,
//     load: (from, to) => supabase.from('t').select('*').range(from, to)
//       .then(({ data }) => (data ?? []) as Row[]),
//     deps: [gymId],
//   });
//   <ScrollView onScroll={(e) => nearBottom(e) && loadMore()} scrollEventThrottle={200}>
//     {items?.map(...)}
//   </ScrollView>

import { useCallback, useEffect, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

type Args<T> = {
  pageSize?: number;
  // Returns rows for the half-open range [from, to] inclusive. Supabase's
  // .range() uses inclusive bounds, so to=from+pageSize-1.
  load: (from: number, to: number) => Promise<T[]>;
  // Resets the list whenever any of these change.
  deps: any[];
};

export function useInfiniteList<T>({ pageSize = 50, load, deps }: Args<T>) {
  const [items, setItems] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  // Tracks how many rows we've already pulled so the next call hits the
  // correct range. Reset on dep change.
  const offset = useRef(0);
  // Request counter so a stale page (deps changed mid-fetch) can be
  // discarded instead of mangling the new list.
  const reqId = useRef(0);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    const myReq = ++reqId.current;
    const from = offset.current;
    const to = from + pageSize - 1;
    try {
      const newItems = await load(from, to);
      if (myReq !== reqId.current) return;
      setItems((prev) => (prev ? [...prev, ...newItems] : newItems));
      offset.current = from + newItems.length;
      setHasMore(newItems.length === pageSize);
    } finally {
      if (myReq === reqId.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, loading, hasMore, pageSize]);

  const reload = useCallback(() => {
    reqId.current++;
    offset.current = 0;
    setItems(null);
    setHasMore(true);
  }, []);

  // Reset whenever deps change. The follow-up effect below kicks off
  // the first page once items === null.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, deps);

  useEffect(() => {
    if (items === null && hasMore && !loading) loadMore();
  }, [items, hasMore, loading, loadMore]);

  return { items, loading, hasMore, loadMore, reload };
}

// Helper: pass to a ScrollView's onScroll. Returns true when the user
// is within `threshold` pixels of the bottom of the scrollable area.
// Pair with scrollEventThrottle={200} (or higher) to avoid spamming.
export function nearBottom(
  e: NativeSyntheticEvent<NativeScrollEvent>,
  threshold = 400
): boolean {
  const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
  return contentOffset.y + layoutMeasurement.height >= contentSize.height - threshold;
}
