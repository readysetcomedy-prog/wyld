import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
  useWindowDimensions,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { Select } from '@/components/Select';
import { useInfiniteList } from '@/hooks/useInfiniteList';
import { LoadMoreSentinel } from '@/components/LoadMoreSentinel';

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
  otherAvatar: string | null;
  unread: boolean;
};

// Other people the current user could start a conversation with, but
// who don't already have a thread with them. Owner mode populates this
// with members of the gym; admin mode with all profiles. Member mode
// doesn't use it (they already have a thread per gym they belong to).
type Contact = {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [composing, setComposing] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [creatingAdminThread, setCreatingAdminThread] = useState(false);
  // Sidebar search across thread names + "start new conversation" contacts.
  const [search, setSearch] = useState('');
  // People at the same gym who don't have an existing thread with the
  // viewer — surfaced under threads when the search box is non-empty so
  // owners/employees can search for and message anyone in their org.
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [startingThreadFor, setStartingThreadFor] = useState<string | null>(null);
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

  // Paginated thread fetcher. Each page is `last_message_at desc` so the
  // top of the sidebar always has the most recent activity; older
  // conversations stream in as the user scrolls. Per-page we also fetch
  // the joined name/avatar data for whatever rows came back.
  const loadThreadsPage = useCallback(async (from: number, to: number): Promise<ThreadWithMeta[]> => {
    if (!myId) return [];

    let q = supabase.from('message_threads').select('*');
    if (mode === 'owner') {
      if (!gymId) return [];
      q = q.eq('gym_id', gymId);
    } else if (mode === 'member') {
      q = q.eq('user_id', myId);
    } else {
      q = q.or('kind.eq.admin_user,and(kind.eq.contact_form,gym_id.is.null)');
    }
    const { data, error } = await q
      .order('last_message_at', { ascending: false })
      .range(from, to);
    if (error) { setErr(error.message); return []; }

    const list = (data as Thread[]) ?? [];
    if (list.length === 0) return [];
    const userIds = Array.from(new Set(list.filter((t) => t.user_id).map((t) => t.user_id!)));
    const gymIds = Array.from(new Set(list.filter((t) => t.gym_id).map((t) => t.gym_id!)));
    const [{ data: users }, { data: gyms }, { data: gymThemes }] = await Promise.all([
      userIds.length
        ? supabase.from('profiles').select('id, full_name, email, avatar_url').in('id', userIds)
        : Promise.resolve({ data: [] as any[] }),
      gymIds.length
        ? supabase.from('gyms').select('id, name').in('id', gymIds)
        : Promise.resolve({ data: [] as any[] }),
      gymIds.length
        ? supabase.from('gym_themes').select('gym_id, logo_url').in('gym_id', gymIds).is('location_id', null)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const userMap = new Map<string, { name: string; email: string; avatar_url: string | null }>(
      (users ?? []).map((u: any) => [u.id, {
        name: u.full_name || u.email, email: u.email, avatar_url: u.avatar_url ?? null,
      }])
    );
    const gymMap = new Map<string, string>((gyms ?? []).map((g: any) => [g.id, g.name]));
    const gymLogoMap = new Map<string, string | null>(
      (gymThemes ?? []).map((t: any) => [t.gym_id, t.logo_url ?? null])
    );

    return list.map((t) => {
      let otherName = 'Unknown';
      let otherAvatar: string | null = null;
      if (t.kind === 'member_gym') {
        if (mode === 'owner') {
          const u = userMap.get(t.user_id!);
          otherName = u?.name ?? 'Member';
          otherAvatar = u?.avatar_url ?? null;
        } else {
          otherName = gymMap.get(t.gym_id!) ?? 'Gym';
          otherAvatar = gymLogoMap.get(t.gym_id!) ?? null;
        }
      } else if (t.kind === 'admin_user') {
        if (mode === 'admin') {
          const u = userMap.get(t.user_id!);
          otherName = u?.name ?? 'User';
          otherAvatar = u?.avatar_url ?? null;
        } else {
          otherName = 'WyLD Admin';
        }
      } else if (t.kind === 'contact_form') {
        otherName = t.anon_name ? `${t.anon_name} (contact form)` : 'Contact form';
      }
      const readAt = t[readField] as string | null;
      const unread = readAt == null || new Date(t.last_message_at) > new Date(readAt);
      return { ...t, otherName, otherAvatar, unread };
    });
  }, [mode, gymId, myId, readField]);

  const { items: threads, loading: threadsLoading, hasMore: threadsHasMore, loadMore: loadMoreThreads, reload: reloadThreads } =
    useInfiniteList<ThreadWithMeta>({
      pageSize: 50,
      load: loadThreadsPage,
      deps: [mode, gymId, myId],
    });

  // Notify parent of (loaded) unread count. This is approximate when the
  // viewer has more than one page of threads — older unread conversations
  // off-screen aren't counted until their page loads — but the more
  // important behavior is that the sidebar reflects unread state for
  // anything currently rendered.
  useEffect(() => {
    if (!threads) return;
    onUnreadChange?.(threads.filter((t) => t.unread).length);
  }, [threads, onUnreadChange]);

  // Replacement for the previous loadThreads() callers — they all just
  // wanted "reset the thread list so the new state shows up".
  const loadThreads = reloadThreads;

  // Load the pool of people the viewer can search to start a new
  // conversation. Owner mode: everyone at their gym (members + employees).
  // Admin mode: all profiles. Member mode is intentionally empty.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (mode === 'owner' && gymId) {
        const [{ data: mems }, { data: emps }] = await Promise.all([
          supabase
            .from('gym_memberships')
            .select('member:profiles!gym_memberships_member_id_fkey(id, full_name, email, avatar_url)')
            .eq('gym_id', gymId),
          supabase
            .from('gym_employees')
            .select('user_id, email, full_name, avatar_url')
            .eq('gym_id', gymId)
            .is('terminate_date', null),
        ]);
        if (cancelled) return;
        const map = new Map<string, Contact>();
        ((mems as any[]) ?? []).forEach((m) => {
          const u = m.member;
          if (u?.id) map.set(u.id, {
            user_id: u.id, name: u.full_name || u.email, email: u.email, avatar_url: u.avatar_url,
          });
        });
        // Employees may not have a profile linkage yet (user_id null); skip those.
        ((emps as any[]) ?? []).forEach((e) => {
          if (!e.user_id) return;
          if (!map.has(e.user_id)) {
            map.set(e.user_id, {
              user_id: e.user_id,
              name: e.full_name || e.email,
              email: e.email,
              avatar_url: e.avatar_url ?? null,
            });
          }
        });
        setContacts(Array.from(map.values()));
      } else if (mode === 'admin') {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .limit(500);
        if (cancelled) return;
        setContacts(((data as any[]) ?? []).map((u) => ({
          user_id: u.id, name: u.full_name || u.email, email: u.email, avatar_url: u.avatar_url ?? null,
        })));
      } else {
        setContacts([]);
      }
    })();
    return () => { cancelled = true; };
  }, [mode, gymId]);

  // user_id -> avatar_url for everyone who has sent a message in the
  // currently-open thread, plus the active thread's "other party" gym
  // logo if applicable. Used to render the small avatar next to each
  // bubble in the conversation.
  const [senderAvatars, setSenderAvatars] = useState<Map<string, string | null>>(new Map());
  // Pagination for messages inside the open thread. We load the latest
  // PAGE_SIZE first (most recent at the bottom), then a "Load older"
  // affordance prepends older pages so opening a thread with 10k
  // messages never has to ship them all at once.
  const MESSAGES_PAGE = 50;
  const [olderLoading, setOlderLoading] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);

  const resolveAvatarsFor = useCallback(async (msgs: Message[]) => {
    const senderIds = Array.from(
      new Set(msgs.map((m) => m.sender_user_id).filter((v): v is string => !!v))
    );
    if (senderIds.length === 0) return;
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, avatar_url')
      .in('id', senderIds);
    setSenderAvatars((prev) => {
      const next = new Map(prev);
      ((profs as any[]) ?? []).forEach((p) => next.set(p.id, p.avatar_url ?? null));
      return next;
    });
  }, []);

  const loadMessages = useCallback(
    async (threadId: string) => {
      // Latest page first: order desc, take PAGE_SIZE, then reverse for
      // ascending display.
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: false })
        .limit(MESSAGES_PAGE + 1);
      if (error) { setErr(error.message); return; }
      const raw = ((data as Message[]) ?? []);
      const more = raw.length > MESSAGES_PAGE;
      const msgs = (more ? raw.slice(0, MESSAGES_PAGE) : raw).slice().reverse();
      setMessages(msgs);
      setHasOlder(more);
      setSenderAvatars(new Map());
      resolveAvatarsFor(msgs);

      const patch: Record<string, string> = {};
      patch[readField as string] = new Date().toISOString();
      await supabase.from('message_threads').update(patch).eq('id', threadId);
      loadThreads();
    },
    [readField, loadThreads, resolveAvatarsFor]
  );

  const loadOlderMessages = useCallback(async () => {
    if (!activeId || olderLoading || messages.length === 0) return;
    setOlderLoading(true);
    const oldestSoFar = messages[0].created_at;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('thread_id', activeId)
      .lt('created_at', oldestSoFar)
      .order('created_at', { ascending: false })
      .limit(MESSAGES_PAGE + 1);
    const raw = ((data as Message[]) ?? []);
    const more = raw.length > MESSAGES_PAGE;
    const older = (more ? raw.slice(0, MESSAGES_PAGE) : raw).slice().reverse();
    setMessages((prev) => [...older, ...prev]);
    setHasOlder(more);
    resolveAvatarsFor(older);
    setOlderLoading(false);
  }, [activeId, olderLoading, messages, resolveAvatarsFor]);

  useEffect(() => {
    if (activeId) loadMessages(activeId);
    else { setMessages([]); setHasOlder(false); }
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

  // Open (or create) a thread with the chosen contact. Owner reaches a
  // member_gym thread for the gym; admin reaches an admin_user thread for
  // the user. Either way: find-or-create, then make it active.
  async function openContactThread(c: Contact) {
    if (!myId) return;
    setStartingThreadFor(c.user_id);
    setErr(null);
    let id: string | undefined;
    if (mode === 'owner' && gymId) {
      const { data: existing } = await supabase
        .from('message_threads')
        .select('id')
        .eq('kind', 'member_gym')
        .eq('gym_id', gymId)
        .eq('user_id', c.user_id)
        .maybeSingle();
      if (existing) {
        id = (existing as any).id;
      } else {
        const { data: created, error } = await supabase
          .from('message_threads')
          .insert({ kind: 'member_gym', gym_id: gymId, user_id: c.user_id })
          .select('id')
          .single();
        if (error) { setErr(error.message); setStartingThreadFor(null); return; }
        id = (created as any).id;
      }
    } else if (mode === 'admin') {
      const { data: existing } = await supabase
        .from('message_threads')
        .select('id')
        .eq('kind', 'admin_user')
        .eq('user_id', c.user_id)
        .maybeSingle();
      if (existing) {
        id = (existing as any).id;
      } else {
        const { data: created, error } = await supabase
          .from('message_threads')
          .insert({ kind: 'admin_user', user_id: c.user_id })
          .select('id')
          .single();
        if (error) { setErr(error.message); setStartingThreadFor(null); return; }
        id = (created as any).id;
      }
    }
    setStartingThreadFor(null);
    if (id) {
      setSearch('');
      await loadThreads();
      setActiveId(id);
    }
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

  const trimmedSearch = search.trim().toLowerCase();
  const visibleThreads = threads
    .filter((t) => !(mode === 'owner' && locFilter && t.location_id !== locFilter))
    .filter((t) => {
      if (!trimmedSearch) return true;
      const hay = `${t.otherName} ${t.subject ?? ''} ${t.anon_email ?? ''}`.toLowerCase();
      return hay.includes(trimmedSearch);
    });

  // When the viewer is searching and there are people we know about who
  // don't have a thread with them yet, surface them so the viewer can
  // start a conversation. Skip anyone with an active thread already.
  const threadUserIds = new Set(
    threads.filter((t) => t.user_id).map((t) => t.user_id as string)
  );
  const matchingContacts = trimmedSearch && contacts.length > 0
    ? contacts.filter((c) =>
        !threadUserIds.has(c.user_id) &&
        c.user_id !== myId &&
        `${c.name} ${c.email}`.toLowerCase().includes(trimmedSearch)
      ).slice(0, 30)
    : [];

  return (
    <View style={[styles.root, !isWide && styles.rootNarrow]}>
      {isWide || !activeId ? (
      <View style={[styles.sidebar, !isWide && styles.sidebarNarrow]}>
        <Text style={styles.sidebarTitle}>Conversations</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={
            mode === 'owner' ? 'Search members + employees…'
            : mode === 'admin' ? 'Search users…'
            : 'Search conversations…'
          }
          placeholderTextColor="#94a3b8"
          style={styles.searchInput}
        />
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
        {visibleThreads.length === 0 && matchingContacts.length === 0 ? (
          <Text style={styles.dim}>
            {trimmedSearch ? 'No matches.' : 'No conversations yet.'}
          </Text>
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
                <Avatar url={t.otherAvatar} name={t.otherName} size={36} />
                <View style={{ flex: 1 }}>
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
                </View>
              </Pressable>
            ))}
            {matchingContacts.length > 0 ? (
              <View style={styles.contactsBlock}>
                <Text style={styles.contactsHead}>Start new conversation</Text>
                {matchingContacts.map((c) => (
                  <Pressable
                    key={c.user_id}
                    style={[styles.threadRow, startingThreadFor === c.user_id && { opacity: 0.5 }]}
                    disabled={startingThreadFor !== null}
                    onPress={() => openContactThread(c)}
                  >
                    <Avatar url={c.avatar_url} name={c.name} size={36} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.threadName} numberOfLines={1}>{c.name}</Text>
                      <Text style={styles.threadSub} numberOfLines={1}>{c.email}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {!trimmedSearch ? (
              <LoadMoreSentinel
                loading={threadsLoading}
                hasMore={threadsHasMore}
                onLoadMore={loadMoreThreads}
              />
            ) : null}
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
              <Avatar url={active.otherAvatar} name={active.otherName} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={styles.threadHeaderName}>{active.otherName}</Text>
                {active.kind === 'contact_form' && active.anon_email ? (
                  <Text style={styles.threadHeaderSub}>Reply to: {active.anon_email}</Text>
                ) : null}
              </View>
            </View>

            <ScrollView style={styles.messageList} contentContainerStyle={styles.messageListInner}>
              {hasOlder ? (
                <Pressable
                  style={[styles.loadOlderBtn, olderLoading && { opacity: 0.6 }]}
                  disabled={olderLoading}
                  onPress={loadOlderMessages}
                >
                  <Text style={styles.loadOlderBtnText}>
                    {olderLoading ? 'Loading…' : '↑ Load older messages'}
                  </Text>
                </Pressable>
              ) : null}
              {messages.length === 0 ? (
                <Text style={styles.dim}>No messages yet.</Text>
              ) : (
                messages.map((m) => {
                  const fromMe = isFromMe(m, mode, myId);
                  // Pick an avatar for the sender. Human senders -> their
                  // profile avatar. Gym senders (sender_is_gym from the
                  // owner side) -> the gym's logo, which is whatever
                  // we already fetched for the active thread's otherAvatar.
                  let senderAvatar: string | null = null;
                  if (m.sender_is_gym && !fromMe) senderAvatar = active.otherAvatar;
                  else if (m.sender_user_id) senderAvatar = senderAvatars.get(m.sender_user_id) ?? null;
                  return (
                    <View
                      key={m.id}
                      style={[
                        styles.bubbleRow,
                        fromMe ? styles.bubbleRowMe : styles.bubbleRowThem,
                      ]}
                    >
                      {!fromMe ? (
                        <Avatar url={senderAvatar} name={active.otherName} size={28} />
                      ) : null}
                      <View
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

// Round avatar with image-or-initials fallback. Used in the sidebar
// thread list, the active-thread header, and next to each "them" bubble
// in the conversation so it's easy to tell who said what.
function Avatar({ url, name, size }: { url: string | null; name: string; size: number }) {
  const initials = (name || '?')
    .split(/[\s@]/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const radius = size / 2;
  if (url) {
    return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: radius, backgroundColor: '#e2e8f0' }} />;
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: radius,
      backgroundColor: theme.colors.wyldPurple,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.4 }}>{initials}</Text>
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
  searchInput: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7, fontSize: 13,
    color: theme.colors.charcoal, backgroundColor: '#fff',
  },
  list: { flexGrow: 0 },
  dim: { color: theme.colors.textSecondary, fontStyle: 'italic', fontSize: 13 },
  threadRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 8, paddingVertical: 8,
    borderRadius: 8, marginBottom: 2,
  },
  threadRowActive: { backgroundColor: '#eef2ff' },
  threadRowHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  threadName: { fontSize: 14, fontWeight: '600', color: theme.colors.charcoal, flex: 1 },
  threadNameUnread: { fontWeight: '800' },
  threadSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  contactsBlock: {
    marginTop: 10, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: theme.colors.border,
  },
  contactsHead: {
    fontSize: 11, fontWeight: '800', color: theme.colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, paddingHorizontal: 4,
  },
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
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  threadHeaderName: { fontSize: 16, fontWeight: '800', color: theme.colors.charcoal },
  threadHeaderSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  messageList: { flex: 1 },
  messageListInner: { padding: 16, gap: 8 },
  loadOlderBtn: {
    alignSelf: 'center',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  loadOlderBtnText: { color: theme.colors.textSecondary, fontWeight: '700', fontSize: 12 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bubbleRowMe: { justifyContent: 'flex-end' },
  bubbleRowThem: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', padding: 12, borderRadius: 12, gap: 4 },
  bubbleMe: { backgroundColor: theme.colors.wyldPurple },
  bubbleThem: { backgroundColor: '#f1f5f9' },
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
