import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { Select } from '@/components/Select';

export type ViewMode = 'owner' | 'member' | 'admin';

type Thread = {
  id: string;
  kind: 'member_gym' | 'admin_user' | 'contact_form';
  gym_id: string | null;
  user_id: string | null;
  location_id: string | null;
  anon_name: string | null;
  anon_email: string | null;
  subject: string | null;
  last_message_at: string;
  user_last_read_at: string | null;
  gym_last_read_at: string | null;
  admin_last_read_at: string | null;
};

type Message = {
  id: string;
  thread_id: string;
  sender_user_id: string | null;
  sender_is_gym: boolean;
  sender_is_admin: boolean;
  sender_is_anon: boolean;
  body: string;
  created_at: string;
};

type ThreadWithMeta = Thread & {
  otherName: string;
  unread: boolean;
};

export function MessagesView({
  mode,
  gymId,
  onUnreadChange,
}: {
  mode: ViewMode;
  gymId?: string | null;
  onUnreadChange?: (count: number) => void;
}) {
  const { profile } = useAuth();
  const myId = profile?.id ?? null;
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const [threads, setThreads] = useState<ThreadWithMeta[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [composing, setComposing] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [creatingAdminThread, setCreatingAdminThread] = useState(false);
  // Owner location filter
  const [locations, setLocations] = useState<{ id: string; label: string | null }[]>([]);
  const [locFilter, setLocFilter] = useState<string | null>(null); // null = all

  useEffect(() => {
    if (mode !== 'owner' || !gymId) return;
    supabase
      .from('gym_locations')
      .select('id, label')
      .eq('gym_id', gymId)
      .order('display_order')
      .then(({ data }) => setLocations((data as any) ?? []));
  }, [mode, gymId]);

  const readField: keyof Thread =
    mode === 'owner' ? 'gym_last_read_at' : mode === 'admin' ? 'admin_last_read_at' : 'user_last_read_at';

  const loadThreads = useCallback(async () => {
    if (!myId) return;

    let q = supabase.from('message_threads').select('*');
    if (mode === 'owner') {
      if (!gymId) {
        setThreads([]);
        return;
      }
      q = q.eq('gym_id', gymId);
    } else if (mode === 'member') {
      // Member sees threads where they're the user_id (member_gym + admin_user)
      q = q.eq('user_id', myId);
    } else {
      // admin: support threads, plus gym-less contact_form threads — which is
      // where "Get a Quote" requests from the public site land.
      q = q.or('kind.eq.admin_user,and(kind.eq.contact_form,gym_id.is.null)');
    }
    const { data, error } = await q.order('last_message_at', { ascending: false });
    if (error) {
      setErr(error.message);
      return;
    }

    // Enrich: figure out "otherName" labels.
    const list = (data as Thread[]) ?? [];
    const userIds = Array.from(
      new Set(list.filter((t) => t.user_id).map((t) => t.user_id!))
    );
    const gymIds = Array.from(
      new Set(list.filter((t) => t.gym_id).map((t) => t.gym_id!))
    );
    const [{ data: users }, { data: gyms }] = await Promise.all([
      userIds.length
        ? supabase.from('profiles').select('id, full_name, email').in('id', userIds)
        : Promise.resolve({ data: [] as any[] }),
      gymIds.length
        ? supabase.from('gyms').select('id, name').in('id', gymIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const userMap = new Map<string, { name: string; email: string }>(
      (users ?? []).map((u: any) => [u.id, { name: u.full_name || u.email, email: u.email }])
    );
    const gymMap = new Map<string, string>((gyms ?? []).map((g: any) => [g.id, g.name]));

    const enriched: ThreadWithMeta[] = list.map((t) => {
      let otherName = 'Unknown';
      if (t.kind === 'member_gym') {
        otherName = mode === 'owner'
          ? userMap.get(t.user_id!)?.name ?? 'Member'
          : gymMap.get(t.gym_id!) ?? 'Gym';
      } else if (t.kind === 'admin_user') {
        otherName = mode === 'admin' ? userMap.get(t.user_id!)?.name ?? 'User' : 'WyLD Admin';
      } else if (t.kind === 'contact_form') {
        otherName = t.anon_name ? `${t.anon_name} (contact form)` : 'Contact form';
      }
      const readAt = t[readField] as string | null;
      const unread = readAt == null || new Date(t.last_message_at) > new Date(readAt);
      return { ...t, otherName, unread };
    });

    setThreads(enriched);
    onUnreadChange?.(enriched.filter((t) => t.unread).length);
  }, [mode, gymId, myId, readField, onUnreadChange]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const loadMessages = useCallback(
    async (threadId: string) => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at');
      if (error) {
        setErr(error.message);
        return;
      }
      setMessages((data as Message[]) ?? []);

      // Mark thread read.
      const patch: Record<string, string> = {};
      patch[readField as string] = new Date().toISOString();
      await supabase.from('message_threads').update(patch).eq('id', threadId);
      // Refresh thread list to clear unread badge.
      loadThreads();
    },
    [readField, loadThreads]
  );

  useEffect(() => {
    if (activeId) loadMessages(activeId);
    else setMessages([]);
  }, [activeId, loadMessages]);

  async function send() {
    if (!activeId || !composing.trim() || !myId) return;
    setSending(true);
    setErr(null);
    const { error } = await supabase.from('messages').insert({
      thread_id: activeId,
      sender_user_id: myId,
      sender_is_gym: mode === 'owner',
      sender_is_admin: mode === 'admin',
      body: composing.trim(),
    });
    setSending(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setComposing('');
    loadMessages(activeId);
    loadThreads();
  }

  async function startAdminThread() {
    if (!myId) return;
    setCreatingAdminThread(true);
    setErr(null);
    // Find existing or create one.
    const { data: existing } = await supabase
      .from('message_threads')
      .select('id')
      .eq('kind', 'admin_user')
      .eq('user_id', myId)
      .maybeSingle();
    let id = existing?.id as string | undefined;
    if (!id) {
      const { data: created, error } = await supabase
        .from('message_threads')
        .insert({ kind: 'admin_user', user_id: myId, subject: 'Talk to WyLD' })
        .select('id')
        .single();
      if (error) {
        setErr(error.message);
        setCreatingAdminThread(false);
        return;
      }
      id = (created as any).id as string;
    }
    setCreatingAdminThread(false);
    loadThreads();
    setActiveId(id!);
  }

  const active = useMemo(
    () => threads?.find((t) => t.id === activeId) ?? null,
    [threads, activeId]
  );

  if (threads === null) return <ActivityIndicator color={theme.colors.charcoal} />;

  const visibleThreads =
    mode === 'owner' && locFilter
      ? threads.filter((t) => t.location_id === locFilter)
      : threads;

  return (
    <View style={[styles.root, !isWide && styles.rootNarrow]}>
      {isWide || !activeId ? (
      <View style={[styles.sidebar, !isWide && styles.sidebarNarrow]}>
        <Text style={styles.sidebarTitle}>Conversations</Text>
        {mode === 'owner' && locations.length > 0 ? (
          <Select
            ariaLabel="Filter by location"
            fullWidth
            value={locFilter ?? 'all'}
            onChange={(v) => setLocFilter(v === 'all' ? null : v)}
            options={[
              { value: 'all', label: 'All locations' },
              ...locations.map((l) => ({ value: l.id, label: l.label || 'Location' })),
            ]}
          />
        ) : null}
        {mode === 'member' && !threads.some((t) => t.kind === 'admin_user') ? (
          <Pressable
            style={styles.startAdmin}
            disabled={creatingAdminThread}
            onPress={startAdminThread}
          >
            <Text style={styles.startAdminText}>+ Message WyLD support</Text>
          </Pressable>
        ) : null}
        {visibleThreads.length === 0 ? (
          <Text style={styles.dim}>No conversations yet.</Text>
        ) : (
          <ScrollView style={styles.list}>
            {visibleThreads.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => setActiveId(t.id)}
                style={[
                  styles.threadRow,
                  activeId === t.id && styles.threadRowActive,
                ]}
              >
                <View style={styles.threadRowHead}>
                  <Text
                    style={[styles.threadName, t.unread && styles.threadNameUnread]}
                    numberOfLines={1}
                  >
                    {t.otherName}
                  </Text>
                  {t.unread ? <View style={styles.unreadDot} /> : null}
                </View>
                <Text style={styles.threadSub} numberOfLines={1}>
                  {t.subject || labelForKind(t.kind)} ·{' '}
                  {new Date(t.last_message_at).toLocaleDateString()}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
      ) : null}

      {isWide || activeId ? (
      <View style={[styles.pane, !isWide && styles.paneNarrow]}>
        {!isWide && active ? (
          <Pressable onPress={() => setActiveId(null)} style={styles.backRow}>
            <Text style={styles.backRowText}>‹ Conversations</Text>
          </Pressable>
        ) : null}
        {!active ? (
          <View style={styles.emptyPane}>
            <Text style={styles.dim}>Select a conversation to read.</Text>
          </View>
        ) : (
          <>
            <View style={styles.threadHeader}>
              <Text style={styles.threadHeaderName}>{active.otherName}</Text>
              {active.kind === 'contact_form' && active.anon_email ? (
                <Text style={styles.threadHeaderSub}>Reply to: {active.anon_email}</Text>
              ) : null}
            </View>

            <ScrollView style={styles.messageList} contentContainerStyle={styles.messageListInner}>
              {messages.length === 0 ? (
                <Text style={styles.dim}>No messages yet.</Text>
              ) : (
                messages.map((m) => {
                  const fromMe = isFromMe(m, mode, myId);
                  return (
                    <View
                      key={m.id}
                      style={[
                        styles.bubble,
                        fromMe ? styles.bubbleMe : styles.bubbleThem,
                      ]}
                    >
                      <Text style={fromMe ? styles.bubbleTextMe : styles.bubbleTextThem}>
                        {m.body}
                      </Text>
                      <Text style={fromMe ? styles.bubbleMetaMe : styles.bubbleMetaThem}>
                        {new Date(m.created_at).toLocaleString()}
                      </Text>
                    </View>
                  );
                })
              )}
            </ScrollView>

            {active.kind === 'contact_form' ? (
              <View style={styles.composer}>
                <Text style={styles.dim}>
                  Contact-form messages don&apos;t support in-app replies. Email them at{' '}
                  <Text style={styles.bold}>{active.anon_email}</Text>.
                </Text>
              </View>
            ) : (
              <View style={styles.composer}>
                <TextInput
                  value={composing}
                  onChangeText={setComposing}
                  placeholder="Type a message…"
                  placeholderTextColor="#94a3b8"
                  style={styles.composerInput}
                  multiline
                />
                {err ? <Text style={styles.err}>{err}</Text> : null}
                <Pressable
                  onPress={send}
                  disabled={sending || !composing.trim()}
                  style={[styles.sendBtn, (sending || !composing.trim()) && { opacity: 0.5 }]}
                >
                  <Text style={styles.sendBtnText}>{sending ? 'Sending…' : 'Send'}</Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </View>
      ) : null}
    </View>
  );
}

function labelForKind(k: Thread['kind']) {
  if (k === 'member_gym') return 'Direct message';
  if (k === 'admin_user') return 'WyLD support';
  return 'Contact form';
}

function isFromMe(m: Message, mode: ViewMode, myId: string | null) {
  if (m.sender_is_anon) return false;
  if (mode === 'owner') return m.sender_is_gym;
  if (mode === 'admin') return m.sender_is_admin;
  return m.sender_user_id === myId;
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', gap: 16, minHeight: 500, flex: 1 },
  rootNarrow: { flexDirection: 'column' },
  sidebarNarrow: { width: '100%' },
  paneNarrow: { width: '100%', flex: undefined as any, minHeight: 480 },
  backRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backRowText: { fontSize: 14, fontWeight: '700', color: theme.colors.wyldPurple },
  sidebar: {
    width: 280,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: '#fff',
    padding: 12,
    gap: 8,
  },
  sidebarTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.charcoal },
  list: { flexGrow: 0 },
  dim: { color: theme.colors.textSecondary, fontStyle: 'italic', fontSize: 13 },
  threadRow: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 2,
  },
  threadRowActive: { backgroundColor: '#eef2ff' },
  threadRowHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  threadName: { fontSize: 14, fontWeight: '600', color: theme.colors.charcoal, flex: 1 },
  threadNameUnread: { fontWeight: '800' },
  threadSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.wyldPurple,
  },
  startAdmin: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    marginBottom: 6,
  },
  startAdminText: { fontSize: 13, fontWeight: '700', color: theme.colors.wyldPurple },

  pane: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  emptyPane: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  threadHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  threadHeaderName: { fontSize: 16, fontWeight: '800', color: theme.colors.charcoal },
  threadHeaderSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  messageList: { flex: 1 },
  messageListInner: { padding: 16, gap: 8 },
  bubble: { maxWidth: '78%', padding: 12, borderRadius: 12, gap: 4 },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: theme.colors.wyldPurple },
  bubbleThem: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f9',
  },
  bubbleTextMe: { color: '#fff', fontSize: 14, lineHeight: 20 },
  bubbleTextThem: { color: theme.colors.charcoal, fontSize: 14, lineHeight: 20 },
  bubbleMetaMe: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  bubbleMetaThem: { color: theme.colors.textSecondary, fontSize: 11 },
  composer: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    padding: 12,
    gap: 8,
  },
  composerInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 60,
    textAlignVertical: 'top',
    fontSize: 14,
    color: theme.colors.charcoal,
    backgroundColor: '#fff',
  },
  sendBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.colors.wyldPurple,
  },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  err: { color: theme.colors.danger, fontSize: 12 },
  bold: { fontWeight: '700', color: theme.colors.charcoal },
});
