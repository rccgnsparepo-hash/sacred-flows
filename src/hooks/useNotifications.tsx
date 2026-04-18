import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface NotificationItem {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'message' | 'post' | 'admin';
  actor_id: string | null;
  post_id: string | null;
  comment_id: string | null;
  message: string | null;
  is_read: boolean;
  created_at: string;
  actor_name?: string;
  actor_avatar?: string | null;
}

export function useNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (!data) { setLoading(false); return; }
    const actorIds = [...new Set(data.map(n => n.actor_id).filter(Boolean) as string[])];
    const { data: profs } = actorIds.length
      ? await supabase.from('profiles').select('user_id, name, avatar_url').in('user_id', actorIds)
      : { data: [] as { user_id: string; name: string; avatar_url: string | null }[] };
    const map = new Map(profs?.map(p => [p.user_id, p]) || []);
    const enriched = data.map(n => ({
      ...n,
      type: n.type as NotificationItem['type'],
      actor_name: n.actor_id ? map.get(n.actor_id)?.name : undefined,
      actor_avatar: n.actor_id ? map.get(n.actor_id)?.avatar_url : null,
    }));
    setItems(enriched);
    setUnread(enriched.filter(n => !n.is_read).length);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`notif-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, load]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('recipient_id', user.id).eq('is_read', false);
    setItems(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnread(0);
  };

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnread(prev => Math.max(0, prev - 1));
  };

  return { items, unread, loading, markAllRead, markRead, refresh: load };
}
