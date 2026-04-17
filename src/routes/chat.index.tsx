import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BottomNav } from '@/components/BottomNav';
import { ArrowLeft, MessageCircle } from 'lucide-react';

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

function ChatList() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!isLoading && !user) navigate({ to: '/auth' }); }, [user, isLoading, navigate]);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('conversations').select('*').or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`).order('last_message_at', { ascending: false });
    if (!data) { setLoading(false); return; }
    const otherIds = data.map(c => c.user1_id === user.id ? c.user2_id : c.user1_id);
    const { data: profs } = await supabase.from('profiles').select('user_id, name, avatar_url, username').in('user_id', otherIds);
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

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="px-5 pt-14">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => window.history.back()} className="neu-btn p-2"><ArrowLeft size={18} /></button>
          <h1 className="text-[22px] font-bold text-foreground">Messages</h1>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-8">Loading...</p>
        ) : convs.length === 0 ? (
          <div className="text-center py-16">
            <MessageCircle size={48} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-[14px]">No conversations yet</p>
            <p className="text-muted-foreground text-[12px] mt-1">Tap "Message" on any profile to start chatting</p>
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
      <BottomNav />
    </div>
  );
}
