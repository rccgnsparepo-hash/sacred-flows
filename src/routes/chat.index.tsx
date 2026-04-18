import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BottomNav } from '@/components/BottomNav';
import { ArrowLeft, MessageCircle, Search, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/chat/')({
  head: () => ({ meta: [{ title: 'Chats — NSP Socials' }] }),
  component: ChatList,
});

interface ConvRow {
  id: string;
  user1_id: string;
  user2_id: string;
  last_message_at: string;
  other?: { user_id: string; name: string; avatar_url: string | null; username: string | null };
  last_message?: string;
}

interface UserRow {
  user_id: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
}

function ChatList() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => { if (!isLoading && !user) navigate({ to: '/auth' }); }, [user, isLoading, navigate]);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('conversations').select('*').or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`).order('last_message_at', { ascending: false });
    if (!data) { setLoading(false); return; }
    const otherIds = data.map(c => c.user1_id === user.id ? c.user2_id : c.user1_id);
    const { data: profs } = otherIds.length
      ? await supabase.from('profiles').select('user_id, name, avatar_url, username').in('user_id', otherIds)
      : { data: [] };
    const profMap = new Map(profs?.map(p => [p.user_id, p]) || []);

    const enriched = await Promise.all(data.map(async c => {
      const otherId = c.user1_id === user.id ? c.user2_id : c.user1_id;
      const { data: lastMsg } = await supabase.from('dm_messages').select('content, media_url').eq('conversation_id', c.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      return {
        ...c,
        other: profMap.get(otherId) ? { ...profMap.get(otherId)!, user_id: otherId } : { user_id: otherId, name: 'User', avatar_url: null, username: null },
        last_message: lastMsg?.content || (lastMsg?.media_url ? '📎 Media' : ''),
      };
    }));
    setConvs(enriched);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel('conv-list').on('postgres_changes', { event: '*', schema: 'public', table: 'dm_messages' }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, load]);

  const loadUsers = useCallback(async () => {
    if (!user) return;
    setSearchLoading(true);
    let q = supabase.from('profiles').select('user_id, name, username, avatar_url').neq('user_id', user.id).limit(50);
    if (search.trim()) {
      q = q.or(`name.ilike.%${search.trim()}%,username.ilike.%${search.trim()}%`);
    }
    const { data } = await q;
    if (data) setUsers(data);
    setSearchLoading(false);
  }, [user, search]);

  useEffect(() => {
    if (!showNew) return;
    const t = setTimeout(loadUsers, 200);
    return () => clearTimeout(t);
  }, [showNew, loadUsers]);

  const startChat = async (otherId: string) => {
    const { data, error } = await supabase.rpc('get_or_create_conversation', { other_user_id: otherId });
    if (error || !data) { toast.error('Could not start chat'); return; }
    setShowNew(false);
    navigate({ to: '/chat/$id', params: { id: data } });
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="px-5 pt-14">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate({ to: '/more' })} className="neu-btn p-2"><ArrowLeft size={18} /></button>
            <h1 className="text-[22px] font-bold text-foreground">Messages</h1>
          </div>
          <button onClick={() => setShowNew(true)} className="neu-btn p-3" aria-label="New chat">
            <Plus size={18} className="text-primary" />
          </button>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-8">Loading...</p>
        ) : convs.length === 0 ? (
          <div className="text-center py-16">
            <MessageCircle size={48} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-[14px]">No conversations yet</p>
            <button onClick={() => setShowNew(true)} className="mt-4 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold">
              Start a new chat
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {convs.map(c => (
              <Link key={c.id} to="/chat/$id" params={{ id: c.id }} className="neu-card p-3 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full neu-convex flex items-center justify-center overflow-hidden shrink-0">
                  {c.other?.avatar_url ? (
                    <img src={c.other.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-bold text-primary">{c.other?.name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-foreground truncate">{c.other?.name}</p>
                  <p className="text-[12px] text-muted-foreground truncate">{c.last_message || 'Start a conversation'}</p>
                </div>
                <p className="text-[10px] text-muted-foreground">{new Date(c.last_message_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* New chat sheet */}
      {showNew && (
        <div className="fixed inset-0 z-[100] flex items-end bg-foreground/40 backdrop-blur-sm" onClick={() => setShowNew(false)}>
          <div className="w-full max-h-[85vh] bg-background rounded-t-3xl flex flex-col slide-up" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <h3 className="text-[16px] font-bold text-foreground">New Chat</h3>
              <button onClick={() => setShowNew(false)} className="p-2 text-muted-foreground"><X size={18} /></button>
            </div>
            <div className="p-4 border-b border-border/50">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name or username..."
                  className="w-full pl-10 pr-4 py-3 neu-input text-foreground text-[14px] placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {searchLoading ? (
                <p className="text-center text-muted-foreground text-[13px] py-8">Searching...</p>
              ) : users.length === 0 ? (
                <p className="text-center text-muted-foreground text-[13px] py-8">No users found</p>
              ) : users.map(u => (
                <button key={u.user_id} onClick={() => startChat(u.user_id)} className="w-full neu-card-sm p-3 flex items-center gap-3 text-left">
                  <div className="w-10 h-10 rounded-full neu-convex flex items-center justify-center overflow-hidden shrink-0">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-bold text-primary text-[13px]">{u.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-foreground truncate">{u.name}</p>
                    {u.username && <p className="text-[12px] text-muted-foreground truncate">@{u.username}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
