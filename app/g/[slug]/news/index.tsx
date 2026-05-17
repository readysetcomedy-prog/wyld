import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useGymSite } from '@/components/GymSiteContext';
import { supabase } from '@/lib/supabase';
import { DateTimeField } from '@/components/DateTimeField';

type Post = {
  id: string;
  slug: string;
  title: string;
  body: string;
  cover_image_url: string | null;
  published_at: string;
};

const PAGE_SIZE = 9;

export default function NewsList() {
  const site = useGymSite();
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);

  // Filters
  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);

  const loadingRef = useRef(false);
  const locId = site.currentLocation?.id ?? null;

  const fetchPage = useCallback(
    async (pageIndex: number, replace: boolean) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);

      const locFilter = locId
        ? `location_id.is.null,location_id.eq.${locId}`
        : 'location_id.is.null';
      let q = supabase
        .from('gym_news_posts')
        .select('id, slug, title, body, cover_image_url, published_at')
        .eq('gym_id', site.gym.id)
        .or(locFilter)
        .not('published_at', 'is', null)
        .lte('published_at', new Date().toISOString());

      if (appliedKeyword.trim()) {
        const kw = appliedKeyword.trim().replace(/[%,]/g, '');
        q = q.or(`title.ilike.%${kw}%,body.ilike.%${kw}%`);
      }
      if (dateFrom) {
        const start = new Date(dateFrom);
        start.setHours(0, 0, 0, 0);
        q = q.gte('published_at', start.toISOString());
      }
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        q = q.lte('published_at', end.toISOString());
      }

      const from = pageIndex * PAGE_SIZE;
      const { data } = await q
        .order('published_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      const rows = (data as Post[]) ?? [];
      setPosts((prev) => (replace ? rows : [...prev, ...rows]));
      setHasMore(rows.length === PAGE_SIZE);
      setPage(pageIndex);
      setLoading(false);
      loadingRef.current = false;
    },
    [site.gym.id, locId, appliedKeyword, dateFrom, dateTo]
  );

  // Reload from scratch whenever applied filters change.
  useEffect(() => {
    fetchPage(0, true);
  }, [fetchPage]);

  // Infinite scroll on web: load the next page near the bottom of the window.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onScroll = () => {
      if (loadingRef.current || !hasMore) return;
      const nearBottom =
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 700;
      if (nearBottom) fetchPage(page + 1, false);
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, [fetchPage, page, hasMore]);

  if (!site.modules.news_enabled) {
    return <Redirect href={`/g/${slug}` as never} />;
  }

  const pageContent = site.pages.news ?? {};
  const heading = pageContent.headline || 'News';
  const intro: string = pageContent.body || '';

  return (
    <View style={[styles.page, isWide && styles.pageWide]}>
      <Text style={[styles.h1, { color: site.theme.primary_color }]}>{heading}</Text>
      {intro ? (
        <View style={styles.intro}>
          {intro.split('\n').filter((p) => p.trim()).map((para, i) => (
            <Text key={i} style={styles.para}>{para}</Text>
          ))}
        </View>
      ) : null}

      {/* Search / filter bar */}
      <View style={[styles.filterBar, isWide && styles.filterBarWide]}>
        <View style={styles.filterField}>
          <Text style={styles.filterLabel}>Search</Text>
          <TextInput
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={() => setAppliedKeyword(keyword)}
            placeholder="Keyword in title or post"
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
          />
        </View>
        <View style={styles.filterField}>
          <Text style={styles.filterLabel}>From</Text>
          <DateTimeField
            mode="date"
            placeholder="Any time"
            value={dateFrom}
            onChange={setDateFrom}
          />
        </View>
        <View style={styles.filterField}>
          <Text style={styles.filterLabel}>To</Text>
          <DateTimeField
            mode="date"
            placeholder="Any time"
            value={dateTo}
            onChange={setDateTo}
          />
        </View>
        <Pressable
          style={[styles.searchBtn, { backgroundColor: site.theme.accent_color }]}
          onPress={() => setAppliedKeyword(keyword)}
        >
          <Text style={styles.searchBtnText}>Search</Text>
        </Pressable>
        {(appliedKeyword || dateFrom || dateTo) ? (
          <Pressable
            style={styles.clearBtn}
            onPress={() => {
              setKeyword('');
              setAppliedKeyword('');
              setDateFrom(null);
              setDateTo(null);
            }}
          >
            <Text style={styles.clearBtnText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {posts.length === 0 && !loading ? (
        <Text style={styles.dim}>
          {appliedKeyword || dateFrom || dateTo
            ? 'No posts match your search.'
            : 'No posts yet. Check back soon.'}
        </Text>
      ) : (
        <View style={[styles.grid, isWide && styles.gridWide]}>
          {posts.map((p) => (
            <Pressable
              key={p.id}
              style={[styles.card, isWide && styles.cardWide]}
              onPress={() => router.push(`/g/${slug}/news/${p.slug}` as never)}
            >
              {p.cover_image_url ? (
                <Image source={{ uri: p.cover_image_url }} style={styles.cover} resizeMode="cover" />
              ) : (
                <View style={[styles.cover, { backgroundColor: site.theme.primary_color, opacity: 0.08 }]} />
              )}
              <View style={styles.cardBody}>
                <Text style={styles.date}>
                  {new Date(p.published_at).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
                <Text style={[styles.title, { color: site.theme.primary_color }]}>{p.title}</Text>
                <Text style={styles.excerpt} numberOfLines={3}>
                  {p.body.slice(0, 200)}
                </Text>
                <Text style={[styles.readMore, { color: site.theme.accent_color }]}>Read more →</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {loading ? <ActivityIndicator color={site.theme.accent_color} /> : null}

      {hasMore && !loading && posts.length > 0 ? (
        <Pressable
          style={styles.loadMore}
          onPress={() => fetchPage(page + 1, false)}
        >
          <Text style={styles.loadMoreText}>Load more posts</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingVertical: 24, gap: 24 },
  pageWide: {
    paddingHorizontal: 40,
    paddingVertical: 56,
    maxWidth: 1240,
    width: '100%',
    alignSelf: 'center',
  },
  h1: { fontSize: 36, fontWeight: '800', lineHeight: 44 },
  intro: { gap: 12, maxWidth: 760 },
  para: { fontSize: 16, color: '#0F172A', lineHeight: 26 },
  dim: { color: '#94a3b8', fontStyle: 'italic' },

  filterBar: {
    flexDirection: 'column',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  filterBarWide: { flexDirection: 'row', alignItems: 'flex-end' },
  filterField: { flex: 1, gap: 4, minWidth: 140 },
  filterLabel: { fontSize: 12, fontWeight: '700', color: '#475569' },
  searchInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    backgroundColor: '#fff',
    color: '#0F172A',
  },
  searchBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10 },
  searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  clearBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  clearBtnText: { color: '#475569', fontWeight: '700', fontSize: 14 },

  grid: { gap: 16 },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  cardWide: { flexBasis: 360, flexGrow: 1, maxWidth: '48%' },
  cover: { width: '100%', height: 180 },
  cardBody: { padding: 16, gap: 6 },
  date: { fontSize: 12, color: '#475569', fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  title: { fontSize: 20, fontWeight: '800' },
  excerpt: { fontSize: 14, color: '#475569', lineHeight: 20 },
  readMore: { fontSize: 14, fontWeight: '700', marginTop: 4 },

  loadMore: {
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  loadMoreText: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
});
