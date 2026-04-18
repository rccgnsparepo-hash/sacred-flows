import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PostCard, type PostData } from '@/components/PostCard';
import { CommentsSheet } from '@/components/CommentsSheet';
import { BottomNav } from '@/components/BottomNav';
import { ArrowLeft, Shield, Send, Pin, Image as ImageIcon, X } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/feed/admin')({
  head: () => ({ meta: [{ title: 'Admin Feed — NSP Socials' }] }),
  component: AdminFeed,
});

function AdminFeed() {
  const { user, isLoading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostData[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [media, setMedia] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!isLoading && !user) navigate({ to: '/auth' }); }, [user, isLoading, navigate]);

  const load = useCallback(async () => {
    if (!user) return;
    const { data: admins } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
    const adminIds = admins?.map(a => a.user_id) || [];
    if (adminIds.length === 0) { setPosts([]); setLoading(false); return; }
    const { data } = await supabase.from('posts').select('*').in('user_id', adminIds).order('created_at', { ascending: false }).limit(50);
    if (data) {
      const { data: profs } = await supabase.from('profiles').select('user_id, name, avatar_url, username').in('user_id', adminIds);
      const profMap = new Map(profs?.map(p => [p.user_id, p]) || []);
      setPosts(data.map(p => ({ ...p, user_name: profMap.get(p.user_id)?.name, user_avatar: profMap.get(p.user_id)?.avatar_url || undefined, user_username: profMap.get(p.user_id)?.username, is_admin_post: true })));
    }
    const { data: likes } = await supabase.from('likes').select('post_id').eq('user_id', user.id);
    if (likes) setLikedIds(new Set(likes.map(l => l.post_id)));
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel('admin-feed').on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const toggleLike = async (postId: string) => {
    if (!user) return;
    const liked = likedIds.has(postId);
    setLikedIds(prev => { const s = new Set(prev); liked ? s.delete(postId) : s.add(postId); return s; });
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, like_count: p.like_count + (liked ? -1 : 1) } : p));
    if (liked) await supabase.from('likes').delete().eq('user_id', user.id).eq('post_id', postId);
    else await supabase.from('likes').insert({ user_id: user.id, post_id: postId });
  };

  const handleBroadcast = async () => {
    if (!user || !isAdmin) return;
    if (!text.trim() && !media) { toast.error('Add text or media'); return; }
    setPosting(true);
    try {
      let mediaUrl: string | null = null;
      let mediaType: string | null = null;
      if (media) {
        const ext = media.name.split('.').pop();
        const path = `admin/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from('church-files').upload(path, media, { contentType: media.type });
        if (error) throw error;
        const { data } = supabase.storage.from('church-files').getPublicUrl(path);
        mediaUrl = data.publicUrl;
        mediaType = media.type.startsWith('video') ? 'video' : 'image';
      }
      const { error: insErr } = await supabase.from('posts').insert({
        user_id: user.id,
        content_text: text.trim() || null,
        media_url: mediaUrl,
        media_type: mediaType,
        is_featured: true,
      });
      if (insErr) throw insErr;
      toast.success('Broadcast sent! 📢');
      setText(''); setMedia(null);
      if (fileRef.current) fileRef.current.value = '';
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to post');
    } finally {
      setPosting(false);
    }
  };

  const pinned = posts.find(p => p.is_featured) || posts[0];
  const rest = posts.filter(p => p.id !== pinned?.id);

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="px-5 pt-14">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate({ to: '/more' })} className="neu-btn p-2"><ArrowLeft size={18} /></button>
          <Shield size={20} className="text-church-gold" />
          <h1 className="text-[22px] font-bold text-foreground">Admin Feed</h1>
        </div>

        {/* Admin composer */}
        {isAdmin && (
          <div className="neu-card p-4 mb-6 border-2 border-church-gold/30">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={14} className="text-church-gold" />
              <p className="text-[12px] font-bold text-church-gold uppercase tracking-wider">Broadcast as Admin</p>
            </div>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Share an announcement with the community..."
              rows={3}
              className="w-full px-3 py-2.5 neu-input text-foreground text-[14px] placeholder:text-muted-foreground focus:outline-none resize-none mb-3"
            />
            {media && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-muted">
                <ImageIcon size={14} className="text-primary" />
                <span className="text-[12px] text-foreground flex-1 truncate">{media.name}</span>
                <button onClick={() => { setMedia(null); if (fileRef.current) fileRef.current.value = ''; }}>
                  <X size={14} className="text-muted-foreground" />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={e => setMedia(e.target.files?.[0] || null)} />
              <button onClick={() => fileRef.current?.click()} className="neu-btn p-3 text-primary"><ImageIcon size={16} /></button>
              <button onClick={handleBroadcast} disabled={posting || (!text.trim() && !media)} className="flex-1 py-3 rounded-xl bg-church-gold text-church-gold-foreground text-[14px] font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                <Send size={14} /> {posting ? 'Sending...' : 'Broadcast'}
              </button>
            </div>
          </div>
        )}

        {/* Pinned latest */}
        {pinned && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Pin size={14} className="text-church-gold" />
              <p className="text-[12px] font-bold text-church-gold uppercase tracking-wider">Latest Broadcast</p>
            </div>
            <PostCard post={pinned} isLiked={likedIds.has(pinned.id)} onToggleLike={() => toggleLike(pinned.id)} onOpenComments={() => setCommentsPostId(pinned.id)} />
          </div>
        )}

        <div className="space-y-4">
          {loading ? <p className="text-center text-muted-foreground py-8">Loading...</p> :
            rest.length === 0 && !pinned ? <p className="text-center text-muted-foreground py-8 text-[14px]">No admin posts yet</p> :
            rest.map(p => (
              <PostCard key={p.id} post={p} isLiked={likedIds.has(p.id)} onToggleLike={() => toggleLike(p.id)} onOpenComments={() => setCommentsPostId(p.id)} />
            ))}
        </div>
      </div>
      {commentsPostId && <CommentsSheet postId={commentsPostId} onClose={() => setCommentsPostId(null)} />}
      <BottomNav />
    </div>
  );
}
