import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { useCollabUnread } from '@/hooks/useCollabUnread';

type Channel = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  archived: boolean;
  created_by: string | null;
  created_at: string;
};

type Attachment = { id: string; url: string; kind: string; width: number | null; height: number | null };

type Message = {
  id: string;
  channel_id: string;
  author_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  attachments: Attachment[];
};

type TeamMember = {
  id: string;
  email: string;
  full_name: string | null;
};

export default function AdminCollaboration() {
  const { profile } = useAuth();
  const userId = profile?.id ?? null;
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [composing, setComposing] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const { byChannel: unreadByChannel } = useCollabUnread(userId);

  const teamById = useMemo(() => {
    const m = new Map<string, TeamMember>();
    team.forEach((t) => m.set(t.id, t));
    return m;
  }, [team]);

  const loadChannels = useCallback(async () => {
    const { data } = await supabase
      .from('wyld_collab_channels')
      .select('*')
      .eq('archived', false)
      .order('created_at');
    const rows = (data as Channel[] | null) ?? [];
    setChannels(rows);
    setSelectedId((cur) => cur ?? rows[0]?.id ?? null);
  }, []);

  const loadTeam = useCallback(async () => {
    // WyLD team = admins + WyLD employees with perm_collaboration. We load
    // both, then merge to profile records for display.
    const { data: admins } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('role', 'admin');
    const { data: wyld } = await supabase
      .from('gyms')
      .select('id')
      .eq('slug', 'wyld')
      .maybeSingle();
    let employees: any[] = [];
    if ((wyld as any)?.id) {
      const { data: emps } = await supabase
        .from('gym_employees')
        .select('user_id, email, full_name')
        .eq('gym_id', (wyld as any).id)
        .eq('perm_collaboration', true)
        .not('user_id', 'is', null);
      employees = (emps as any[]) ?? [];
    }
    const map = new Map<string, TeamMember>();
    ((admins as any[]) ?? []).forEach((p) => map.set(p.id, p));
    employees.forEach((e) =>
      map.set(e.user_id, { id: e.user_id, email: e.email, full_name: e.full_name })
    );
    setTeam(Array.from(map.values()));
  }, []);

  useEffect(() => {
    loadChannels();
    loadTeam();
  }, [loadChannels, loadTeam]);

  async function createChannel() {
    setErr(null);
    const name = newChannelName.trim();
    if (!name) return;
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!slug) {
      setErr('Channel name must have at least one letter or number.');
      return;
    }
    const { data, error } = await supabase
      .from('wyld_collab_channels')
      .insert({
        name,
        slug,
        description: newChannelDesc.trim() || null,
        created_by: userId,
      })
      .select('*')
      .maybeSingle();
    if (error) {
      setErr(error.message);
      return;
    }
    setComposing(false);
    setNewChannelName('');
    setNewChannelDesc('');
    if (data) {
      setChannels((prev) => [...(prev ?? []), data as Channel]);
      setSelectedId((data as Channel).id);
    }
  }

  const selected = channels?.find((c) => c.id === selectedId) ?? null;

  return (
    <View style={[styles.page, isWide && styles.pageWide]}>
      <View style={[styles.rail, isWide && styles.railWide]}>
        <View style={styles.railHeader}>
          <Text style={styles.railTitle}>Feeds</Text>
          <Pressable onPress={() => setComposing((v) => !v)} style={styles.newBtn}>
            <Text style={styles.newBtnText}>{composing ? '×' : '+ New'}</Text>
          </Pressable>
        </View>
        {composing ? (
          <View style={styles.newPanel}>
            <TextInput
              value={newChannelName}
              onChangeText={setNewChannelName}
              placeholder="Channel name (e.g. roadmap)"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              onSubmitEditing={createChannel}
            />
            <TextInput
              value={newChannelDesc}
              onChangeText={setNewChannelDesc}
              placeholder="Description (optional)"
              placeholderTextColor="#94a3b8"
              style={styles.input}
            />
            {err ? <Text style={styles.err}>{err}</Text> : null}
            <Pressable onPress={createChannel} style={styles.btnPrimary}>
              <Text style={styles.btnPrimaryText}>Create</Text>
            </Pressable>
          </View>
        ) : null}
        {channels === null ? (
          <ActivityIndicator color={theme.colors.wyldPurple} />
        ) : channels.length === 0 ? (
          <Text style={styles.dim}>No channels yet.</Text>
        ) : (
          <View style={{ gap: 2 }}>
            {channels.map((c) => {
              const isActive = c.id === selectedId;
              const unread = unreadByChannel[c.id] ?? 0;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setSelectedId(c.id)}
                  style={[styles.channelRow, isActive && styles.channelRowActive]}
                >
                  <Text
                    style={[
                      styles.channelHash,
                      isActive && { color: '#fff' },
                    ]}
                  >
                    #
                  </Text>
                  <Text
                    style={[
                      styles.channelName,
                      isActive && { color: '#fff' },
                      unread > 0 && !isActive && { fontWeight: '800', color: theme.colors.charcoal },
                    ]}
                    numberOfLines={1}
                  >
                    {c.name}
                  </Text>
                  {unread > 0 ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{unread}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={[styles.main, isWide && styles.mainWide]}>
        {selected && userId ? (
          <ChannelView
            channel={selected}
            userId={userId}
            team={team}
            teamById={teamById}
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.dim}>Pick a feed to start talking.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function ChannelView({
  channel,
  userId,
  team,
  teamById,
}: {
  channel: Channel;
  userId: string;
  team: TeamMember[];
  teamById: Map<string, TeamMember>;
}) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [body, setBody] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load messages + their attachments for this channel.
  const load = useCallback(async () => {
    const { data: msgs } = await supabase
      .from('wyld_collab_messages')
      .select('*')
      .eq('channel_id', channel.id)
      .order('created_at');
    const rows = ((msgs as any[]) ?? []) as Message[];
    if (rows.length === 0) {
      setMessages([]);
      return;
    }
    const { data: atts } = await supabase
      .from('wyld_collab_attachments')
      .select('*')
      .in(
        'message_id',
        rows.map((m) => m.id)
      );
    const byMsg = new Map<string, Attachment[]>();
    ((atts as any[]) ?? []).forEach((a: any) => {
      const list = byMsg.get(a.message_id) ?? [];
      list.push(a);
      byMsg.set(a.message_id, list);
    });
    rows.forEach((m) => (m.attachments = byMsg.get(m.id) ?? []));
    setMessages(rows);
  }, [channel.id]);

  // Mark the channel as read.
  const markRead = useCallback(async () => {
    await supabase
      .from('wyld_collab_reads')
      .upsert(
        { channel_id: channel.id, user_id: userId, last_read_at: new Date().toISOString() },
        { onConflict: 'channel_id,user_id' }
      );
  }, [channel.id, userId]);

  useEffect(() => {
    setMessages(null);
    load().then(markRead);
  }, [load, markRead]);

  // Realtime: subscribe to new messages for this channel.
  useEffect(() => {
    const sub = supabase
      .channel(`collab-msgs-${channel.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'wyld_collab_messages',
          filter: `channel_id=eq.${channel.id}`,
        },
        async () => {
          await load();
          await markRead();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [channel.id, load, markRead]);

  // Auto-scroll to bottom when messages change.
  useEffect(() => {
    if (messages && messages.length > 0) {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false }));
    }
  }, [messages?.length]);

  async function pickImage(file: File) {
    setErr(null);
    setUploading(true);
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage.from('wyld-collab').upload(path, file, {
      contentType: file.type || 'image/png',
      upsert: false,
    });
    if (upErr) {
      setErr(upErr.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from('wyld-collab').getPublicUrl(path);
    setPendingAttachments((prev) => [
      ...prev,
      {
        id: `pending-${Date.now()}`,
        url: data.publicUrl,
        kind: 'image',
        width: null,
        height: null,
      },
    ]);
    setUploading(false);
  }

  async function send() {
    setErr(null);
    const text = body.trim();
    if (!text && pendingAttachments.length === 0) return;
    setSending(true);
    const { data: msgRow, error: insErr } = await supabase
      .from('wyld_collab_messages')
      .insert({
        channel_id: channel.id,
        author_id: userId,
        body: text || '(image)',
      })
      .select('*')
      .maybeSingle();
    if (insErr || !msgRow) {
      setSending(false);
      setErr(insErr?.message ?? 'Failed to send');
      return;
    }
    const newMsg = msgRow as Message;
    if (pendingAttachments.length > 0) {
      await supabase.from('wyld_collab_attachments').insert(
        pendingAttachments.map((a) => ({
          message_id: newMsg.id,
          url: a.url,
          kind: a.kind,
        }))
      );
    }
    // Resolve @mentions and record them.
    const mentions = parseMentions(text, team);
    if (mentions.length > 0) {
      await supabase.from('wyld_collab_mentions').insert(
        mentions.map((uid) => ({ message_id: newMsg.id, user_id: uid }))
      );
    }
    setBody('');
    setPendingAttachments([]);
    setSending(false);
    await load();
    await markRead();
  }

  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  return (
    <View style={styles.channel}>
      <View style={styles.channelHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.channelTitle}># {channel.name}</Text>
          {channel.description ? (
            <Text style={styles.channelDesc}>{channel.description}</Text>
          ) : null}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesInner}
      >
        {messages === null ? (
          <ActivityIndicator color={theme.colors.wyldPurple} />
        ) : messages.length === 0 ? (
          <Text style={styles.dim}>
            No messages yet — kick off the conversation.
          </Text>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            const groupWithPrev =
              prev &&
              prev.author_id === m.author_id &&
              Date.parse(m.created_at) - Date.parse(prev.created_at) < 5 * 60 * 1000;
            const author = teamById.get(m.author_id);
            return (
              <MessageItem
                key={m.id}
                msg={m}
                author={author}
                groupWithPrev={!!groupWithPrev}
                team={team}
                isOwn={m.author_id === userId}
                onDelete={async () => {
                  if (typeof window !== 'undefined' && !window.confirm('Delete this message?'))
                    return;
                  await supabase.from('wyld_collab_messages').delete().eq('id', m.id);
                  load();
                }}
              />
            );
          })
        )}
      </ScrollView>

      <View style={styles.composer}>
        {pendingAttachments.length > 0 ? (
          <View style={styles.attRow}>
            {pendingAttachments.map((a) => (
              <View key={a.url} style={styles.attChip}>
                <Image source={{ uri: a.url }} style={styles.attThumb} />
                <Pressable
                  onPress={() =>
                    setPendingAttachments((prev) => prev.filter((p) => p.url !== a.url))
                  }
                  style={styles.attRemove}
                >
                  <Text style={styles.attRemoveText}>×</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        {err ? <Text style={styles.err}>{err}</Text> : null}
        <View style={[styles.composerRow, isWide && { alignItems: 'flex-end' }]}>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder={`Message #${channel.name} — use @name to mention`}
            placeholderTextColor="#94a3b8"
            multiline
            style={styles.composerInput}
            onKeyPress={(e) => {
              if (
                Platform.OS === 'web' &&
                (e.nativeEvent as any).key === 'Enter' &&
                !(e.nativeEvent as any).shiftKey
              ) {
                (e as any).preventDefault?.();
                send();
              }
            }}
          />
          {Platform.OS === 'web' ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) pickImage(f);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              />
              <Pressable
                onPress={() => fileInputRef.current?.click()}
                style={styles.iconBtn}
                disabled={uploading}
              >
                <Text style={styles.iconBtnText}>{uploading ? '…' : '📎'}</Text>
              </Pressable>
            </>
          ) : null}
          <Pressable
            onPress={send}
            disabled={sending || (!body.trim() && pendingAttachments.length === 0)}
            style={[
              styles.btnPrimary,
              (sending || (!body.trim() && pendingAttachments.length === 0)) && { opacity: 0.5 },
            ]}
          >
            <Text style={styles.btnPrimaryText}>{sending ? 'Sending…' : 'Send'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function MessageItem({
  msg,
  author,
  groupWithPrev,
  team,
  isOwn,
  onDelete,
}: {
  msg: Message;
  author: TeamMember | undefined;
  groupWithPrev: boolean;
  team: TeamMember[];
  isOwn: boolean;
  onDelete: () => void;
}) {
  const name = author?.full_name || author?.email || 'Unknown';
  const dt = new Date(msg.created_at);
  const time = dt.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <View style={[styles.msg, groupWithPrev && styles.msgGrouped]}>
      {!groupWithPrev ? (
        <View style={styles.msgHead}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(name)}</Text>
          </View>
          <Text style={styles.msgAuthor}>{name}</Text>
          <Text style={styles.msgTime}>{time}</Text>
          {isOwn ? (
            <Pressable onPress={onDelete} style={styles.msgDelete}>
              <Text style={styles.msgDeleteText}>delete</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <View style={[styles.msgBodyWrap, groupWithPrev && styles.msgBodyGrouped]}>
        <FormattedBody body={msg.body} team={team} />
        {msg.attachments && msg.attachments.length > 0 ? (
          <View style={styles.attRow}>
            {msg.attachments.map((a) => (
              <Image key={a.id} source={{ uri: a.url }} style={styles.msgImage} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function FormattedBody({ body, team }: { body: string; team: TeamMember[] }) {
  // Highlight @mentions in-place. Match @ followed by word/dot chars; resolve
  // against team display names (first token of full_name or email local part).
  const parts: { text: string; mention: boolean }[] = [];
  const re = /@([a-zA-Z0-9._-]+)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    if (match.index > last) parts.push({ text: body.slice(last, match.index), mention: false });
    const handle = match[1].toLowerCase();
    const hit = team.some((t) => matchesHandle(t, handle));
    parts.push({ text: match[0], mention: hit });
    last = match.index + match[0].length;
  }
  if (last < body.length) parts.push({ text: body.slice(last), mention: false });

  return (
    <Text style={styles.msgBody}>
      {parts.map((p, i) =>
        p.mention ? (
          <Text key={i} style={styles.mention}>
            {p.text}
          </Text>
        ) : (
          <Text key={i}>{p.text}</Text>
        )
      )}
    </Text>
  );
}

function matchesHandle(t: TeamMember, handle: string): boolean {
  const candidates: string[] = [];
  if (t.full_name) candidates.push(t.full_name.split(/\s+/)[0].toLowerCase());
  candidates.push(t.email.split('@')[0].toLowerCase());
  return candidates.includes(handle);
}

function parseMentions(body: string, team: TeamMember[]): string[] {
  const ids = new Set<string>();
  const re = /@([a-zA-Z0-9._-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const handle = m[1].toLowerCase();
    team.forEach((t) => {
      if (matchesHandle(t, handle)) ids.add(t.id);
    });
  }
  return Array.from(ids);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const styles = StyleSheet.create({
  page: { flex: 1, gap: theme.spacing.md, flexDirection: 'column', minHeight: 560 },
  pageWide: { flexDirection: 'row', gap: theme.spacing.md, alignItems: 'stretch' },

  rail: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  railWide: { width: 240, alignSelf: 'stretch' },
  railHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  railTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.charcoal, letterSpacing: 0.5, textTransform: 'uppercase' },
  newBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: theme.colors.wyldPurple,
  },
  newBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  newPanel: {
    gap: 6,
    padding: 8,
    borderRadius: theme.radius.md,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  channelRowActive: { backgroundColor: theme.colors.wyldPurple },
  channelHash: { color: '#94a3b8', fontSize: 15, fontWeight: '700' },
  channelName: { fontSize: 14, color: theme.colors.charcoal, fontWeight: '600', flex: 1 },
  unreadBadge: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    minWidth: 18,
    alignItems: 'center',
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  main: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 480,
    overflow: 'hidden',
  },
  mainWide: { flex: 1, minHeight: 600 },
  placeholder: { padding: theme.spacing.lg, alignItems: 'center', justifyContent: 'center', flex: 1 },

  channel: { flex: 1 },
  channelHeader: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    flexDirection: 'row',
  },
  channelTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.charcoal },
  channelDesc: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },

  messages: { flex: 1 },
  messagesInner: { padding: theme.spacing.md, gap: 4, paddingBottom: theme.spacing.lg },

  msg: { paddingVertical: 6 },
  msgGrouped: { paddingTop: 0, paddingBottom: 2 },
  msgHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: theme.colors.wyldPurple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  msgAuthor: { fontWeight: '800', color: theme.colors.charcoal, fontSize: 14 },
  msgTime: { fontSize: 11, color: theme.colors.textSecondary },
  msgDelete: { marginLeft: 'auto' },
  msgDeleteText: { fontSize: 11, color: theme.colors.danger, fontWeight: '700' },
  msgBodyWrap: { marginLeft: 40, marginTop: 1, gap: 4 },
  msgBodyGrouped: { marginLeft: 40 },
  msgBody: { color: theme.colors.charcoal, fontSize: 14, lineHeight: 20 },
  mention: { backgroundColor: '#fef3c7', color: '#92400e', fontWeight: '700', paddingHorizontal: 2 },
  msgImage: { width: 220, height: 160, borderRadius: 8, backgroundColor: '#f1f5f9' },

  composer: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: 6,
    backgroundColor: theme.colors.surface,
  },
  composerRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  composerInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    maxHeight: 160,
    fontSize: 14,
    backgroundColor: '#fff',
    color: theme.colors.charcoal,
    textAlignVertical: 'top' as any,
  },

  attRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  attChip: { position: 'relative' },
  attThumb: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#f1f5f9' },
  attRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attRemoveText: { color: '#fff', fontWeight: '900', fontSize: 12, lineHeight: 14 },

  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: { fontSize: 18 },

  btnPrimary: {
    backgroundColor: theme.colors.wyldPurple,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    backgroundColor: '#fff',
    color: theme.colors.charcoal,
  },

  dim: { fontSize: 13, color: theme.colors.textSecondary, fontStyle: 'italic' },
  err: { color: theme.colors.danger, fontSize: 12 },
});
