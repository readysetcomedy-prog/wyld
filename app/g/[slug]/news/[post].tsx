import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
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

export default function NewsPost() {
  const site = useGymSite();
  const router = useRouter();
  const { slug, post } = useLocalSearchParams<{ slug: string; post: string }>();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const [data, setData] = useState<Post | null | 'missing'>(null);

  useEffect(() => {
    (async () => {
      const { data: row } = await supabase
        .from('gym_news_posts')
        .select('id, slug, title, body, cover_image_url, published_at')
        .eq('gym_id', site.gym.id)
        .eq('slug', post)
        .not('published_at', 'is', null)
        .lte('published_at', new Date().toISOString())
        .maybeSingle();
      setData((row as Post | null) ?? 'missing');
    })();
  }, [post, site.gym.id]);

  if (!site.modules.news_enabled) {
    return <Redirect href={`/g/${slug}` as never} />;
  }

  if (data === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={site.theme.accent_color} />
      </View>
    );
  }

  if (data === 'missing') {
    return (
      <View style={[styles.page, isWide && styles.pageWide]}>
        <Text style={[styles.h1, { color: site.theme.primary_color }]}>Post not found</Text>
        <Pressable onPress={() => router.push(`/g/${slug}/news` as never)}>
          <Text style={[styles.back, { color: site.theme.accent_color }]}>‹ Back to news</Text>
        </Pressable>
      </View>
    );
  }

  const p = data;

  return (
    <View style={[styles.page, isWide && styles.pageWide]}>
      <Pressable onPress={() => router.push(`/g/${slug}/news` as never)}>
        <Text style={[styles.back, { color: site.theme.accent_color }]}>‹ Back to news</Text>
      </Pressable>

      <Text style={styles.date}>
        {new Date(p.published_at).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </Text>
      <Text style={[styles.h1, { color: site.theme.primary_color }]}>{p.title}</Text>

      {p.cover_image_url ? (
        <Image source={{ uri: p.cover_image_url }} style={styles.cover} resizeMode="cover" />
      ) : null}

      <View style={styles.body}>
        {p.body
          .split('\n')
          .filter((para) => para.trim())
          .map((para, i) => (
            <Text key={i} style={styles.para}>
              {para}
            </Text>
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { padding: 40, alignItems: 'center' },
  page: { paddingHorizontal: 20, paddingVertical: 24, gap: 16 },
  pageWide: {
    paddingHorizontal: 40,
    paddingVertical: 56,
    maxWidth: 880,
    width: '100%',
    alignSelf: 'center',
  },
  back: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  date: { fontSize: 13, color: '#475569', fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  h1: { fontSize: 40, fontWeight: '800', lineHeight: 48 },
  cover: { width: '100%', aspectRatio: 16 / 9, borderRadius: 16, backgroundColor: '#f8fafc' },
  body: { gap: 16, marginTop: 16 },
  para: { fontSize: 17, color: '#0F172A', lineHeight: 28 },
});
