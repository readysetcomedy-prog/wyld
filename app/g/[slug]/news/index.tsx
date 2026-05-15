import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useGymSite } from '@/components/GymSiteContext';
import { supabase } from '@/lib/supabase';

type Post = {
  id: string;
  slug: string;
  title: string;
  body: string;
  cover_image_url: string | null;
  published_at: string;
};

export default function NewsList() {
  const site = useGymSite();
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const [posts, setPosts] = useState<Post[] | null>(null);

  useEffect(() => {
    (async () => {
      // Shared posts (location_id null) plus the current location's own.
      const locFilter = site.currentLocation
        ? `location_id.is.null,location_id.eq.${site.currentLocation.id}`
        : 'location_id.is.null';
      const { data } = await supabase
        .from('gym_news_posts')
        .select('id, slug, title, body, cover_image_url, published_at')
        .eq('gym_id', site.gym.id)
        .or(locFilter)
        .not('published_at', 'is', null)
        .lte('published_at', new Date().toISOString())
        .order('published_at', { ascending: false });
      setPosts((data as Post[]) ?? []);
    })();
  }, [site.gym.id, site.currentLocation?.id]);

  if (!site.modules.news_enabled) {
    return <Redirect href={`/g/${slug}` as never} />;
  }

  const page = site.pages.news ?? {};
  const heading = page.headline || 'News';
  const intro: string = page.body || '';

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

      {posts == null ? (
        <ActivityIndicator color={site.theme.accent_color} />
      ) : posts.length === 0 ? (
        <Text style={styles.dim}>No posts yet. Check back soon.</Text>
      ) : (
        <View style={[styles.grid, isWide && styles.gridWide]}>
          {posts.map((p) => (
            <Pressable
              key={p.id}
              style={[styles.card, isWide && styles.cardWide]}
              onPress={() => router.push(`/g/${slug}/news/${p.slug}` as never)}
            >
              {p.cover_image_url ? (
                <Image
                  source={{ uri: p.cover_image_url }}
                  style={styles.cover}
                  resizeMode="cover"
                />
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
});
