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

// -------- types

type Channel = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  archived: boolean;
  is_private: boolean;
  created_by: string | null;
  created_at: string;
};

type Attachment = { id: string; url: string; kind: string; width: number | null; height: number | null };
type Reaction = { message_id: string; user_id: string; emoji: string };

type Message = {
  id: string;
  channel_id: string;
  author_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  attachments: Attachment[];
  reactions: Reaction[];
  mentions: string[];
};

type TeamMember = { id: string; email: string; full_name: string | null };

const REACTION_PALETTE = ['👍', '❤️', '😄', '🎉', '🙌', '🔥', '👀', '✅', '🚀'];

// -------- handle / mention helpers

function firstName(t: TeamMember): string {
  if (t.full_name) return t.full_name.split(/\s+/)[0].toLowerCase();
  return t.email.split('@')[0].toLowerCase();
}

function emailLocal(t: TeamMember): string {
  return t.email.split('@')[0].toLowerCase();
}

function pickHandle(t: TeamMember, team: TeamMember[]): string {
  // First-name handle if unique across the team; otherwise email-local.
  const fn = firstName(t);
  const dup = team.some((o) => o.id !== t.id && firstName(o) === fn);
  return dup ? emailLocal(t) : fn;
}

function matchesHandle(t: TeamMember, handle: string, team: TeamMember[]): boolean {
  const h = handle.toLowerCase();
  return firstName(t) === h || emailLocal(t) === h || pickHandle(t, team) === h;
}

function parseMentions(body: string, team: TeamMember[]): string[] {
  const ids = new Set<string>();
  const re = /@([a-zA-Z0-9._-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const handle = m[1];
    team.forEach((t) => {
      if (matchesHandle(t, handle, team)) ids.add(t.id);
    });
  }
  return Array.from(ids);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today at ${time}`;
  if (isYesterday) return `Yesterday at ${time}`;
  const within7 = (now.getTime() - d.getTime()) / 86400000 < 7;
  if (within7) {
    const w = d.toLocaleDateString(undefined, { weekday: 'short' });
    return `${w} at ${time}`;
  }
  const dateStr = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
  return `${dateStr} at ${time}`;
}

// -------- root

export default function AdminCollaboration() {
  const { profile } = useAuth();
  const userId = profile?.id ?? null;
  const isAdmin = profile?.role === 'admin';
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [composing, setComposing] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [newChannelPrivate, setNewChannelPrivate] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

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
    setSelectedId((cur) => {
      if (cur && rows.some((r) => r.id === cur)) return cur;
      return rows[0]?.id ?? null;
    });
  }, []);

  const loadTeam = useCallback(async () => {
    const { data: admins } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('role', 'admin');
    const { data: wyld } = await supabase
      .from('gyms')
      .select('id')
      .eq('slug', 'wyld')
      .maybeSingle();
    let emps: any[] = [];
    if ((wyld as any)?.id) {
      const { data } = await supabase
        .from('gym_employees')
        .select('user_id, email, full_name')
        .eq('gym_id', (wyld as any).id)
        .eq('perm_collaboration', true)
        .not('user_id', 'is', null);
      emps = (data as any[]) ?? [];
    }
    const map = new Map<string, TeamMember>();
    ((admins as any[]) ?? []).forEach((p) => map.set(p.id, p));
    emps.forEach((e) =>
      map.set(e.user_id, { id: e.user_id, email: e.email, full_name: e.full_name })
    );
    setTeam(Array.from(map.values()));
  }, []);

  useEffect(() => {
    loadChannels();
    loadTeam();
  }, [loadChannels, loadTeam]);

  // Realtime: any channel insert/update/archive should refresh the rail.
  useEffect(() => {
    const sub = supabase
      .channel('collab-channels')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wyld_collab_channels' },
        () => loadChannels()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [loadChannels]);

  async function createChannel() {
    setErr(null);
    const name = newChannelName.trim();
    if (!name) return;
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!slug) {
      setErr('Channel name must include at least one letter or number.');
      return;
    }
    const { data, error } = await supabase.rpc('wyld_collab_create_channel', {
      p_name: name,
      p_slug: slug,
      p_description: newChannelDesc.trim() || null,
      p_is_private: newChannelPrivate,
    });
    if (error) {
      setErr(error.message);
      return;
    }
    setComposing(false);
    setNewChannelName('');
    setNewChannelDesc('');
    setNewChannelPrivate(false);
    if (data) {
      // The realtime subscription will refresh the rail; auto-select the
      // newly-created channel.
      setSelectedId(data as string);
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
            <Pressable
              onPress={() => setNewChannelPrivate((v) => !v)}
              style={styles.privateRow}
            >
              <View
                style={[
                  styles.checkbox,
                  newChannelPrivate && styles.checkboxOn,
                ]}
              >
                {newChannelPrivate ? <Text style={styles.checkboxMark}>✓</Text> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.privateLabel}>Private channel</Text>
                <Text style={styles.privateHint}>
                  Only invited members can see or post. Admins must be invited too.
                </Text>
              </View>
            </Pressable>
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
                  <Text style={[styles.channelHash, isActive && { color: '#fff' }]}>
                    {c.is_private ? '🔒' : '#'}
                  </Text>
                  <Text
                    style={[
                      styles.channelName,
                      isActive && { color: '#fff' },
                      unread > 0 && !isActive && {
                        fontWeight: '800',
                        color: theme.colors.charcoal,
                      },
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
            isAdmin={isAdmin}
            team={team}
            teamById={teamById}
            onLightbox={setLightboxUrl}
            onChannelGone={() => setSelectedId(null)}
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.dim}>Pick a feed to start talking.</Text>
          </View>
        )}
      </View>

      {lightboxUrl && Platform.OS === 'web' ? (
        <Pressable style={styles.lightboxBg} onPress={() => setLightboxUrl(null)}>
          <Image source={{ uri: lightboxUrl }} style={styles.lightboxImg} resizeMode="contain" />
          <View style={styles.lightboxClose}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>×</Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

// -------- channel view (header + messages + composer)

function ChannelView({
  channel,
  userId,
  isAdmin,
  team,
  teamById,
  onLightbox,
  onChannelGone,
}: {
  channel: Channel;
  userId: string;
  isAdmin: boolean;
  team: TeamMember[];
  teamById: Map<string, TeamMember>;
  onLightbox: (url: string) => void;
  onChannelGone: () => void;
}) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [editingChannel, setEditingChannel] = useState(false);
  const [draftName, setDraftName] = useState(channel.name);
  const [draftDesc, setDraftDesc] = useState(channel.description ?? '');
  const [chanErr, setChanErr] = useState<string | null>(null);
  const [showingMembers, setShowingMembers] = useState(false);
  const [members, setMembers] = useState<string[]>([]);
  const scrollRef = useRef<ScrollView | null>(null);
  // Pagination: open the latest CHANNEL_PAGE_SIZE messages, then prepend
  // older history via "Load older" so channels with thousands of messages
  // open instantly.
  const CHANNEL_PAGE_SIZE = 50;
  const [hasOlder, setHasOlder] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);

  const isCreator = channel.created_by === userId;
  const canManage = isCreator || isAdmin;
  // For private channels, admin must also be a member to manage.
  const canManagePrivate = channel.is_private
    ? isCreator || (isAdmin && members.includes(userId))
    : canManage;

  // Pulls attachments/reactions/mentions for a batch of messages and
  // attaches them in-place. Bounded by the batch size since we use
  // .in() on the message ids.
  const enrichMessages = useCallback(async (rows: Message[]) => {
    if (rows.length === 0) return;
    const ids = rows.map((m) => m.id);
    const [{ data: atts }, { data: rxns }, { data: mens }] = [
      await supabase.from('wyld_collab_attachments').select('*').in('message_id', ids),
      await supabase.from('wyld_collab_reactions').select('*').in('message_id', ids),
      await supabase.from('wyld_collab_mentions').select('*').in('message_id', ids),
    ];
    const byAtt = new Map<string, Attachment[]>();
    ((atts as any[]) ?? []).forEach((a) => {
      const list = byAtt.get(a.message_id) ?? [];
      list.push(a);
      byAtt.set(a.message_id, list);
    });
    const byRxn = new Map<string, Reaction[]>();
    ((rxns as any[]) ?? []).forEach((r) => {
      const list = byRxn.get(r.message_id) ?? [];
      list.push(r);
      byRxn.set(r.message_id, list);
    });
    const byMen = new Map<string, string[]>();
    ((mens as any[]) ?? []).forEach((m) => {
      const list = byMen.get(m.message_id) ?? [];
      list.push(m.user_id);
      byMen.set(m.message_id, list);
    });
    rows.forEach((m) => {
      m.attachments = byAtt.get(m.id) ?? [];
      m.reactions = byRxn.get(m.id) ?? [];
      m.mentions = byMen.get(m.id) ?? [];
    });
  }, []);

  const load = useCallback(async () => {
    // Latest page first: query desc + limit, then reverse for display.
    const { data: msgs } = await supabase
      .from('wyld_collab_messages')
      .select('*')
      .eq('channel_id', channel.id)
      .order('created_at', { ascending: false })
      .limit(CHANNEL_PAGE_SIZE + 1);
    const raw = ((msgs as any[]) ?? []) as Message[];
    const more = raw.length > CHANNEL_PAGE_SIZE;
    const rows = (more ? raw.slice(0, CHANNEL_PAGE_SIZE) : raw).slice().reverse();
    await enrichMessages(rows);
    setMessages(rows);
    setHasOlder(more);
  }, [channel.id, enrichMessages]);

  const loadOlder = useCallback(async () => {
    if (olderLoading || !hasOlder || !messages || messages.length === 0) return;
    setOlderLoading(true);
    const oldest = messages[0].created_at;
    const { data: msgs } = await supabase
      .from('wyld_collab_messages')
      .select('*')
      .eq('channel_id', channel.id)
      .lt('created_at', oldest)
      .order('created_at', { ascending: false })
      .limit(CHANNEL_PAGE_SIZE + 1);
    const raw = ((msgs as any[]) ?? []) as Message[];
    const more = raw.length > CHANNEL_PAGE_SIZE;
    const older = (more ? raw.slice(0, CHANNEL_PAGE_SIZE) : raw).slice().reverse();
    await enrichMessages(older);
    setMessages((prev) => (prev ? [...older, ...prev] : older));
    setHasOlder(more);
    setOlderLoading(false);
  }, [channel.id, enrichMessages, hasOlder, messages, olderLoading]);

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
    setEditingChannel(false);
    setDraftName(channel.name);
    setDraftDesc(channel.description ?? '');
    setChanErr(null);
    load().then(markRead);
  }, [channel.id, channel.name, channel.description, load, markRead]);

  // Realtime: subscribe to all message / attachment / reaction events on this channel.
  useEffect(() => {
    const sub = supabase
      .channel(`collab-channel-${channel.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wyld_collab_messages',
          filter: `channel_id=eq.${channel.id}`,
        },
        async () => {
          await load();
          await markRead();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wyld_collab_reactions' },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wyld_collab_attachments' },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [channel.id, load, markRead]);

  // Auto-scroll to bottom when the LATEST message changes — fires on
  // initial load and on incoming realtime messages, but does not fire
  // when older history is prepended via Load older (which only changes
  // messages[0], not the last id).
  const latestMessageId = messages && messages.length > 0 ? messages[messages.length - 1].id : null;
  useEffect(() => {
    if (latestMessageId) {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false }));
    }
  }, [latestMessageId]);

  async function saveChannel() {
    const name = draftName.trim();
    if (!name) {
      setChanErr('Name required.');
      return;
    }
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const { error } = await supabase
      .from('wyld_collab_channels')
      .update({ name, slug, description: draftDesc.trim() || null })
      .eq('id', channel.id);
    if (error) {
      setChanErr(error.message);
      return;
    }
    setEditingChannel(false);
  }

  async function deleteChannel() {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        `Delete #${channel.name}? This permanently removes all messages and attachments. This cannot be undone.`
      )
    ) {
      return;
    }
    const { error } = await supabase.from('wyld_collab_channels').delete().eq('id', channel.id);
    if (error) {
      setChanErr(error.message);
      return;
    }
    onChannelGone();
  }

  // Load private-channel members; harmless no-op for public channels.
  const loadMembers = useCallback(async () => {
    if (!channel.is_private) {
      setMembers([]);
      return;
    }
    const { data } = await supabase
      .from('wyld_collab_channel_members')
      .select('user_id')
      .eq('channel_id', channel.id);
    setMembers(((data as any[]) ?? []).map((r) => r.user_id));
  }, [channel.id, channel.is_private]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  // Realtime: keep the members list fresh.
  useEffect(() => {
    if (!channel.is_private) return;
    const sub = supabase
      .channel(`collab-members-${channel.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wyld_collab_channel_members',
          filter: `channel_id=eq.${channel.id}`,
        },
        () => loadMembers()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [channel.id, channel.is_private, loadMembers]);

  async function inviteMember(uid: string) {
    setChanErr(null);
    const { error } = await supabase
      .from('wyld_collab_channel_members')
      .insert({ channel_id: channel.id, user_id: uid, invited_by: userId });
    if (error) {
      setChanErr(error.message);
      return;
    }
    loadMembers();
  }

  async function removeMember(uid: string) {
    setChanErr(null);
    if (
      uid === channel.created_by &&
      typeof window !== 'undefined' &&
      !window.confirm(
        'Remove the channel creator? They will lose access to a channel they made.'
      )
    ) {
      return;
    }
    const { error } = await supabase
      .from('wyld_collab_channel_members')
      .delete()
      .eq('channel_id', channel.id)
      .eq('user_id', uid);
    if (error) {
      setChanErr(error.message);
      return;
    }
    if (uid === userId) {
      onChannelGone();
      return;
    }
    loadMembers();
  }

  return (
    <View style={styles.channel}>
      <View style={styles.channelHeader}>
        <View style={{ flex: 1 }}>
          {!editingChannel ? (
            <>
              <Text style={styles.channelTitle}># {channel.name}</Text>
              {channel.description ? (
                <Text style={styles.channelDesc}>{channel.description}</Text>
              ) : null}
            </>
          ) : (
            <View style={{ gap: 6 }}>
              <TextInput
                value={draftName}
                onChangeText={setDraftName}
                style={styles.input}
                placeholder="Channel name"
                placeholderTextColor="#94a3b8"
              />
              <TextInput
                value={draftDesc}
                onChangeText={setDraftDesc}
                style={styles.input}
                placeholder="Description"
                placeholderTextColor="#94a3b8"
              />
              {chanErr ? <Text style={styles.err}>{chanErr}</Text> : null}
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Pressable onPress={saveChannel} style={styles.btnPrimary}>
                  <Text style={styles.btnPrimaryText}>Save</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setEditingChannel(false);
                    setDraftName(channel.name);
                    setDraftDesc(channel.description ?? '');
                    setChanErr(null);
                  }}
                  style={styles.btnGhost}
                >
                  <Text style={styles.btnGhostText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
        {!editingChannel ? (
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {channel.is_private ? (
              <Pressable onPress={() => setShowingMembers((v) => !v)} style={styles.linkBtn}>
                <Text style={styles.linkBtnText}>
                  {showingMembers ? 'Hide members' : `Members (${members.length})`}
                </Text>
              </Pressable>
            ) : null}
            {canManage ? (
              <>
                <Pressable onPress={() => setEditingChannel(true)} style={styles.linkBtn}>
                  <Text style={styles.linkBtnText}>Edit</Text>
                </Pressable>
                <Pressable onPress={deleteChannel} style={styles.linkBtn}>
                  <Text style={[styles.linkBtnText, { color: theme.colors.danger }]}>Delete</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        ) : null}
      </View>

      {showingMembers && channel.is_private ? (
        <MembersPanel
          channel={channel}
          userId={userId}
          memberIds={members}
          team={team}
          teamById={teamById}
          canManage={canManagePrivate}
          onInvite={inviteMember}
          onRemove={removeMember}
        />
      ) : null}

      <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={styles.messagesInner}>
        {hasOlder && messages !== null ? (
          <Pressable
            style={[styles.loadOlderBtn, olderLoading && { opacity: 0.6 }]}
            disabled={olderLoading}
            onPress={loadOlder}
          >
            <Text style={styles.loadOlderBtnText}>
              {olderLoading ? 'Loading…' : '↑ Load older messages'}
            </Text>
          </Pressable>
        ) : null}
        {messages === null ? (
          <ActivityIndicator color={theme.colors.wyldPurple} />
        ) : messages.length === 0 ? (
          <Text style={styles.dim}>No messages yet — kick off the conversation.</Text>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            const groupWithPrev =
              !!prev &&
              prev.author_id === m.author_id &&
              Date.parse(m.created_at) - Date.parse(prev.created_at) < 5 * 60 * 1000;
            const author = teamById.get(m.author_id);
            return (
              <MessageItem
                key={m.id}
                msg={m}
                author={author}
                team={team}
                teamById={teamById}
                groupWithPrev={groupWithPrev}
                userId={userId}
                isAdmin={isAdmin}
                onLightbox={onLightbox}
                onChanged={load}
              />
            );
          })
        )}
      </ScrollView>

      <Composer
        channelId={channel.id}
        channelName={channel.name}
        userId={userId}
        team={team}
        onSent={async () => {
          await load();
          await markRead();
        }}
      />
    </View>
  );
}

// -------- message item: body + attachments + reactions + edit + delete

function MessageItem({
  msg,
  author,
  team,
  teamById,
  groupWithPrev,
  userId,
  isAdmin,
  onLightbox,
  onChanged,
}: {
  msg: Message;
  author: TeamMember | undefined;
  team: TeamMember[];
  teamById: Map<string, TeamMember>;
  groupWithPrev: boolean;
  userId: string;
  isAdmin: boolean;
  onLightbox: (url: string) => void;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.body);
  const [savingEdit, setSavingEdit] = useState(false);
  const [picking, setPicking] = useState(false);

  const isOwn = msg.author_id === userId;
  const canEdit = isOwn;
  const canDelete = isOwn || isAdmin;
  const name = author?.full_name || author?.email || 'Unknown';
  const isMentioningMe = msg.mentions.includes(userId);

  const reactionsGrouped = useMemo(() => {
    const map = new Map<string, { count: number; mine: boolean; users: string[] }>();
    msg.reactions.forEach((r) => {
      const entry = map.get(r.emoji) ?? { count: 0, mine: false, users: [] };
      entry.count += 1;
      entry.users.push(r.user_id);
      if (r.user_id === userId) entry.mine = true;
      map.set(r.emoji, entry);
    });
    return Array.from(map.entries()).map(([emoji, info]) => ({ emoji, ...info }));
  }, [msg.reactions, userId]);

  async function saveEdit() {
    const next = draft.trim();
    if (!next) return;
    setSavingEdit(true);
    await supabase
      .from('wyld_collab_messages')
      .update({ body: next, edited_at: new Date().toISOString() })
      .eq('id', msg.id);
    // Re-resolve mentions.
    await supabase.from('wyld_collab_mentions').delete().eq('message_id', msg.id);
    const mentions = parseMentions(next, team);
    if (mentions.length > 0) {
      await supabase
        .from('wyld_collab_mentions')
        .insert(mentions.map((uid) => ({ message_id: msg.id, user_id: uid })));
    }
    setSavingEdit(false);
    setEditing(false);
    onChanged();
  }

  async function remove() {
    if (typeof window !== 'undefined' && !window.confirm('Delete this message?')) return;
    await supabase.from('wyld_collab_messages').delete().eq('id', msg.id);
    onChanged();
  }

  async function toggleReaction(emoji: string) {
    const mine = msg.reactions.find((r) => r.user_id === userId && r.emoji === emoji);
    if (mine) {
      await supabase
        .from('wyld_collab_reactions')
        .delete()
        .eq('message_id', msg.id)
        .eq('user_id', userId)
        .eq('emoji', emoji);
    } else {
      await supabase
        .from('wyld_collab_reactions')
        .insert({ message_id: msg.id, user_id: userId, emoji });
    }
    onChanged();
  }

  return (
    <View style={[styles.msg, groupWithPrev && styles.msgGrouped, isMentioningMe && styles.msgMentionMe]}>
      {!groupWithPrev ? (
        <View style={styles.msgHead}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(name)}</Text>
          </View>
          <Text style={styles.msgAuthor}>{name}</Text>
          <Text style={styles.msgTime}>
            {formatTime(msg.created_at)}
            {msg.edited_at ? ' (edited)' : ''}
          </Text>
          <View style={{ marginLeft: 'auto', flexDirection: 'row', gap: 8 }}>
            {canEdit ? (
              <Pressable onPress={() => { setEditing(true); setDraft(msg.body); }}>
                <Text style={styles.msgAction}>edit</Text>
              </Pressable>
            ) : null}
            {canDelete ? (
              <Pressable onPress={remove}>
                <Text style={[styles.msgAction, { color: theme.colors.danger }]}>delete</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
      <View style={[styles.msgBodyWrap, groupWithPrev && styles.msgBodyGrouped]}>
        {editing ? (
          <View style={{ gap: 6 }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              multiline
              style={styles.composerInput}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Pressable onPress={saveEdit} disabled={savingEdit} style={styles.btnPrimary}>
                <Text style={styles.btnPrimaryText}>{savingEdit ? 'Saving…' : 'Save'}</Text>
              </Pressable>
              <Pressable
                onPress={() => { setEditing(false); setDraft(msg.body); }}
                style={styles.btnGhost}
              >
                <Text style={styles.btnGhostText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <FormattedBody body={msg.body} team={team} teamById={teamById} />
        )}
        {msg.attachments && msg.attachments.length > 0 ? (
          <View style={styles.attRow}>
            {msg.attachments.map((a) => (
              <Pressable key={a.id} onPress={() => onLightbox(a.url)}>
                <Image source={{ uri: a.url }} style={styles.msgImage} />
              </Pressable>
            ))}
          </View>
        ) : null}
        {reactionsGrouped.length > 0 || picking ? (
          <View style={styles.rxRow}>
            {reactionsGrouped.map((r) => (
              <Pressable
                key={r.emoji}
                onPress={() => toggleReaction(r.emoji)}
                style={[styles.rxPill, r.mine && styles.rxPillMine]}
              >
                <Text style={styles.rxEmoji}>{r.emoji}</Text>
                <Text style={[styles.rxCount, r.mine && { color: '#fff' }]}>{r.count}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setPicking((v) => !v)} style={styles.rxAdd}>
              <Text style={styles.rxAddText}>{picking ? '×' : '+ '}</Text>
            </Pressable>
            {picking ? (
              <View style={styles.rxPalette}>
                {REACTION_PALETTE.map((e) => (
                  <Pressable
                    key={e}
                    onPress={() => {
                      toggleReaction(e);
                      setPicking(false);
                    }}
                    style={styles.rxPaletteBtn}
                  >
                    <Text style={styles.rxEmoji}>{e}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <Pressable onPress={() => setPicking(true)} style={styles.rxAddInline}>
            <Text style={styles.rxAddInlineText}>+ react</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// -------- members panel for private channels

function MembersPanel({
  channel,
  userId,
  memberIds,
  team,
  teamById,
  canManage,
  onInvite,
  onRemove,
}: {
  channel: Channel;
  userId: string;
  memberIds: string[];
  team: TeamMember[];
  teamById: Map<string, TeamMember>;
  canManage: boolean;
  onInvite: (uid: string) => void;
  onRemove: (uid: string) => void;
}) {
  const [search, setSearch] = useState('');
  const memberSet = useMemo(() => new Set(memberIds), [memberIds]);

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return team
      .filter((t) => !memberSet.has(t.id))
      .filter(
        (t) =>
          !q ||
          (t.full_name ?? '').toLowerCase().includes(q) ||
          t.email.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [search, team, memberSet]);

  const memberRecords = useMemo(
    () => memberIds.map((id) => teamById.get(id)).filter(Boolean) as TeamMember[],
    [memberIds, teamById]
  );

  return (
    <View style={styles.membersPanel}>
      <Text style={styles.membersTitle}>
        Members of #{channel.name} ({memberRecords.length})
      </Text>
      <View style={styles.membersList}>
        {memberRecords.length === 0 ? (
          <Text style={styles.dim}>No members yet.</Text>
        ) : (
          memberRecords.map((m) => (
            <View key={m.id} style={styles.memberRow}>
              <View style={styles.avatarSm}>
                <Text style={styles.avatarSmText}>{initials(m.full_name || m.email)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>
                  {m.full_name || m.email}
                  {m.id === channel.created_by ? (
                    <Text style={styles.memberTag}>  · creator</Text>
                  ) : null}
                  {m.id === userId ? <Text style={styles.memberTag}>  · you</Text> : null}
                </Text>
                <Text style={styles.memberEmail}>{m.email}</Text>
              </View>
              {canManage || m.id === userId ? (
                <Pressable onPress={() => onRemove(m.id)} style={styles.memberRemove}>
                  <Text style={styles.memberRemoveText}>
                    {m.id === userId ? 'Leave' : 'Remove'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ))
        )}
      </View>
      {canManage ? (
        <View style={{ gap: 6 }}>
          <Text style={styles.membersTitle}>Invite</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search team by name or email…"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />
          {candidates.length === 0 ? (
            <Text style={styles.dim}>
              {search ? 'No matching team members.' : 'Everyone on the WyLD team is already in.'}
            </Text>
          ) : (
            <View style={{ gap: 4 }}>
              {candidates.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => onInvite(c.id)}
                  style={styles.memberRow}
                >
                  <View style={styles.avatarSm}>
                    <Text style={styles.avatarSmText}>
                      {initials(c.full_name || c.email)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>{c.full_name || c.email}</Text>
                    <Text style={styles.memberEmail}>{c.email}</Text>
                  </View>
                  <Text style={[styles.linkBtnText, { color: theme.colors.wyldPurple }]}>
                    + Invite
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

// -------- formatted body: @mention highlights + clickable URLs

function FormattedBody({
  body,
  team,
  teamById: _teamById,
}: {
  body: string;
  team: TeamMember[];
  teamById: Map<string, TeamMember>;
}) {
  // Build a token stream of plain text / mention / url.
  type Tok = { kind: 'text' | 'mention' | 'url'; text: string };
  const tokens: Tok[] = [];
  const combined = /(@[a-zA-Z0-9._-]+)|(https?:\/\/[^\s)\]]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = combined.exec(body)) !== null) {
    if (m.index > last) tokens.push({ kind: 'text', text: body.slice(last, m.index) });
    if (m[1]) {
      const handle = m[1].slice(1);
      const hit = team.some((t) => matchesHandle(t, handle, team));
      tokens.push({ kind: hit ? 'mention' : 'text', text: m[1] });
    } else if (m[2]) {
      tokens.push({ kind: 'url', text: m[2] });
    }
    last = m.index + m[0].length;
  }
  if (last < body.length) tokens.push({ kind: 'text', text: body.slice(last) });

  return (
    <Text style={styles.msgBody}>
      {tokens.map((t, i) => {
        if (t.kind === 'mention') {
          return (
            <Text key={i} style={styles.mention}>
              {t.text}
            </Text>
          );
        }
        if (t.kind === 'url') {
          return (
            <Text
              key={i}
              style={styles.link}
              onPress={() => {
                if (typeof window !== 'undefined') window.open(t.text, '_blank');
              }}
            >
              {t.text}
            </Text>
          );
        }
        return <Text key={i}>{t.text}</Text>;
      })}
    </Text>
  );
}

// -------- composer with mention autocomplete + image attach

function Composer({
  channelId,
  channelName,
  userId,
  team,
  onSent,
}: {
  channelId: string;
  channelName: string;
  userId: string;
  team: TeamMember[];
  onSent: () => void;
}) {
  const [body, setBody] = useState('');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textRef = useRef<TextInput | null>(null);

  // Mention context: walk back from caret to find an unterminated @.
  const mentionCtx = useMemo(() => {
    const before = body.slice(0, selection.start);
    const atIdx = before.lastIndexOf('@');
    if (atIdx < 0) return null;
    const after = before.slice(atIdx + 1);
    if (/\s/.test(after)) return null;
    if (atIdx > 0 && !/\s/.test(before[atIdx - 1])) return null;
    return { query: after.toLowerCase(), start: atIdx };
  }, [body, selection.start]);

  const mentionMatches = useMemo(() => {
    if (!mentionCtx) return [];
    const q = mentionCtx.query;
    return team
      .filter((t) => {
        if (t.id === userId) return false;
        return (
          firstName(t).startsWith(q) ||
          emailLocal(t).startsWith(q) ||
          (t.full_name ?? '').toLowerCase().includes(q)
        );
      })
      .slice(0, 6);
  }, [mentionCtx, team, userId]);

  useEffect(() => {
    if (mentionIdx >= mentionMatches.length) setMentionIdx(0);
  }, [mentionMatches.length, mentionIdx]);

  function insertMention(t: TeamMember) {
    if (!mentionCtx) return;
    const before = body.slice(0, mentionCtx.start);
    const after = body.slice(selection.start);
    const handle = pickHandle(t, team);
    const inserted = `@${handle} `;
    const next = before + inserted + after;
    setBody(next);
    const newCaret = before.length + inserted.length;
    setSelection({ start: newCaret, end: newCaret });
    // Refocus on web so user can keep typing.
    requestAnimationFrame(() => textRef.current?.focus());
  }

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
      { id: `pending-${Date.now()}`, url: data.publicUrl, kind: 'image', width: null, height: null },
    ]);
    setUploading(false);
  }

  async function send() {
    setErr(null);
    const text = body.trim();
    if (!text && pendingAttachments.length === 0) return;
    setSending(true);
    const { data, error: insErr } = await supabase
      .from('wyld_collab_messages')
      .insert({
        channel_id: channelId,
        author_id: userId,
        body: text || '(image)',
      })
      .select('*')
      .maybeSingle();
    if (insErr || !data) {
      setSending(false);
      setErr(insErr?.message ?? 'Failed to send');
      return;
    }
    const newMsg = data as Message;
    if (pendingAttachments.length > 0) {
      await supabase
        .from('wyld_collab_attachments')
        .insert(
          pendingAttachments.map((a) => ({ message_id: newMsg.id, url: a.url, kind: a.kind }))
        );
    }
    const mentions = parseMentions(text, team);
    if (mentions.length > 0) {
      await supabase
        .from('wyld_collab_mentions')
        .insert(mentions.map((uid) => ({ message_id: newMsg.id, user_id: uid })));
    }
    setBody('');
    setPendingAttachments([]);
    setSending(false);
    onSent();
  }

  return (
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
      <View style={styles.composerRow}>
        <View style={{ flex: 1, position: 'relative' }}>
          <TextInput
            ref={textRef}
            value={body}
            onChangeText={setBody}
            onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
            placeholder={`Message #${channelName} — use @name to mention`}
            placeholderTextColor="#94a3b8"
            multiline
            style={styles.composerInput}
            onKeyPress={(e) => {
              if (Platform.OS !== 'web') return;
              const key = (e.nativeEvent as any).key;
              const shift = (e.nativeEvent as any).shiftKey;
              if (mentionCtx && mentionMatches.length > 0) {
                if (key === 'ArrowDown') {
                  (e as any).preventDefault?.();
                  setMentionIdx((i) => (i + 1) % mentionMatches.length);
                  return;
                }
                if (key === 'ArrowUp') {
                  (e as any).preventDefault?.();
                  setMentionIdx((i) => (i - 1 + mentionMatches.length) % mentionMatches.length);
                  return;
                }
                if (key === 'Enter' || key === 'Tab') {
                  (e as any).preventDefault?.();
                  insertMention(mentionMatches[mentionIdx]);
                  return;
                }
                if (key === 'Escape') {
                  (e as any).preventDefault?.();
                  // Hack to dismiss: insert a no-op space then erase — simpler: blur+focus
                  textRef.current?.blur();
                  requestAnimationFrame(() => textRef.current?.focus());
                  return;
                }
              }
              if (key === 'Enter' && !shift) {
                (e as any).preventDefault?.();
                send();
              }
            }}
          />
          {mentionCtx && mentionMatches.length > 0 ? (
            <View style={styles.mentionPop}>
              {mentionMatches.map((t, i) => (
                <Pressable
                  key={t.id}
                  onPress={() => insertMention(t)}
                  style={[styles.mentionRow, i === mentionIdx && styles.mentionRowActive]}
                >
                  <View style={styles.avatarSm}>
                    <Text style={styles.avatarSmText}>
                      {initials(t.full_name || t.email)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mentionRowName}>{t.full_name || t.email}</Text>
                    <Text style={styles.mentionRowHandle}>@{pickHandle(t, team)}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
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
  );
}

// -------- styles

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
  railHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  railTitle: {
    fontSize: 14, fontWeight: '800', color: theme.colors.charcoal,
    letterSpacing: 0.5, textTransform: 'uppercase',
  },
  newBtn: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    backgroundColor: theme.colors.wyldPurple,
  },
  newBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  newPanel: {
    gap: 6, padding: 8, borderRadius: theme.radius.md, backgroundColor: '#fff',
    borderWidth: 1, borderColor: theme.colors.border,
  },
  channelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
  },
  channelRowActive: { backgroundColor: theme.colors.wyldPurple },
  channelHash: { color: '#94a3b8', fontSize: 15, fontWeight: '700' },
  channelName: { fontSize: 14, color: theme.colors.charcoal, fontWeight: '600', flex: 1 },
  unreadBadge: {
    backgroundColor: '#dc2626', paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: 999, minWidth: 18, alignItems: 'center',
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  main: {
    flex: 1, backgroundColor: '#fff', borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.border, minHeight: 480, overflow: 'hidden',
  },
  mainWide: { flex: 1, minHeight: 600 },
  placeholder: { padding: theme.spacing.lg, alignItems: 'center', justifyContent: 'center', flex: 1 },

  channel: { flex: 1 },
  channelHeader: {
    padding: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
    flexDirection: 'row', gap: 8,
  },
  channelTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.charcoal },
  channelDesc: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  linkBtn: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 },
  linkBtnText: { fontSize: 12, fontWeight: '700', color: theme.colors.wyldPurple },

  messages: { flex: 1 },
  messagesInner: { padding: theme.spacing.md, gap: 4, paddingBottom: theme.spacing.lg },
  loadOlderBtn: {
    alignSelf: 'center', marginBottom: 8,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  loadOlderBtnText: { color: theme.colors.textSecondary, fontWeight: '700', fontSize: 12 },

  msg: { paddingVertical: 6, paddingHorizontal: 6, borderRadius: 8 },
  msgGrouped: { paddingTop: 0, paddingBottom: 2 },
  msgMentionMe: { backgroundColor: '#fff7ed' },
  msgHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: theme.colors.wyldPurple, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  avatarSm: {
    width: 24, height: 24, borderRadius: 6,
    backgroundColor: theme.colors.wyldPurple, alignItems: 'center', justifyContent: 'center',
  },
  avatarSmText: { color: '#fff', fontWeight: '800', fontSize: 10 },
  msgAuthor: { fontWeight: '800', color: theme.colors.charcoal, fontSize: 14 },
  msgTime: { fontSize: 11, color: theme.colors.textSecondary },
  msgAction: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '700' },
  msgBodyWrap: { marginLeft: 40, marginTop: 1, gap: 4 },
  msgBodyGrouped: { marginLeft: 40 },
  msgBody: { color: theme.colors.charcoal, fontSize: 14, lineHeight: 20 },
  mention: { backgroundColor: '#fef3c7', color: '#92400e', fontWeight: '700', paddingHorizontal: 2 },
  link: { color: theme.colors.wyldPurple, textDecorationLine: 'underline' },
  msgImage: { width: 220, height: 160, borderRadius: 8, backgroundColor: '#f1f5f9' },

  rxRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center', marginTop: 2 },
  rxPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
  },
  rxPillMine: { backgroundColor: theme.colors.wyldPurple, borderColor: theme.colors.wyldPurple },
  rxEmoji: { fontSize: 14 },
  rxCount: { fontSize: 12, fontWeight: '700', color: theme.colors.charcoal },
  rxAdd: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#fff',
  },
  rxAddText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  rxAddInline: { alignSelf: 'flex-start', marginTop: 2, opacity: 0.6 },
  rxAddInlineText: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '700' },
  rxPalette: {
    flexDirection: 'row', gap: 2, padding: 4,
    backgroundColor: '#fff', borderRadius: 8,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  rxPaletteBtn: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },

  composer: {
    borderTopWidth: 1, borderTopColor: theme.colors.border,
    padding: theme.spacing.md, gap: 6, backgroundColor: theme.colors.surface,
  },
  composerRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  composerInput: {
    flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, minHeight: 44, maxHeight: 160,
    fontSize: 14, backgroundColor: '#fff', color: theme.colors.charcoal,
    textAlignVertical: 'top' as any,
  },
  mentionPop: {
    position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 6,
    backgroundColor: '#fff', borderRadius: 10,
    borderWidth: 1, borderColor: theme.colors.border, padding: 4, gap: 2,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  mentionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6,
  },
  mentionRowActive: { backgroundColor: theme.colors.surface },
  mentionRowName: { fontSize: 13, fontWeight: '700', color: theme.colors.charcoal },
  mentionRowHandle: { fontSize: 11, color: theme.colors.textSecondary },

  attRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  attChip: { position: 'relative' },
  attThumb: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#f1f5f9' },
  attRemove: {
    position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 999,
    backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center',
  },
  attRemoveText: { color: '#fff', fontWeight: '900', fontSize: 12, lineHeight: 14 },

  iconBtn: {
    width: 44, height: 44, borderRadius: 10, borderWidth: 1,
    borderColor: theme.colors.border, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnText: { fontSize: 18 },

  btnPrimary: {
    backgroundColor: theme.colors.wyldPurple,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  btnGhost: {
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, height: 44,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  btnGhostText: { color: theme.colors.charcoal, fontWeight: '700', fontSize: 14 },

  input: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 13,
    backgroundColor: '#fff', color: theme.colors.charcoal,
  },

  dim: { fontSize: 13, color: theme.colors.textSecondary, fontStyle: 'italic' },
  err: { color: theme.colors.danger, fontSize: 12 },

  lightboxBg: {
    position: 'absolute' as any,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 9999,
  },
  lightboxImg: { width: '90%', height: '90%' },
  lightboxClose: {
    position: 'absolute' as any, top: 16, right: 16,
    width: 36, height: 36, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },

  privateRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 4,
  },
  checkbox: {
    width: 18, height: 18, borderRadius: 4,
    borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  checkboxOn: {
    backgroundColor: theme.colors.wyldPurple,
    borderColor: theme.colors.wyldPurple,
  },
  checkboxMark: { color: '#fff', fontWeight: '900', fontSize: 12, lineHeight: 14 },
  privateLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.charcoal },
  privateHint: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 1 },

  membersPanel: {
    padding: theme.spacing.md,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  membersTitle: {
    fontSize: 12, fontWeight: '800', letterSpacing: 0.5,
    textTransform: 'uppercase', color: theme.colors.textSecondary,
  },
  membersList: { gap: 4 },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: theme.colors.border,
  },
  memberName: { fontSize: 13, fontWeight: '700', color: theme.colors.charcoal },
  memberEmail: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 1 },
  memberTag: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '500' },
  memberRemove: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  memberRemoveText: {
    fontSize: 11, fontWeight: '700', color: theme.colors.danger,
  },
});
