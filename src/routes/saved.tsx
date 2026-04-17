import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PostCard, type PostData } from '@/components/PostCard';
import { CommentsSheet } from '@/components/CommentsSheet';
import { BottomNav } from '@/components/BottomNav';
import { ArrowLeft, Bookmark } from 'lucide-react';

export const Route = createFileRoute('/saved')({
  head: () => ({ meta: [{ title: 'Saved — NSP Socials' }] }),
  component: SavedPage,
});

function SavedPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostData[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);

  useEffect(() => { if (!isLoading && !user) navigate({ to: '/auth' }); }, [user, isLoading, navigate]);

  const load = useCallback(async () => {
    if (!user) return;
    const { data: saves } = await supabase.from('saves').select('post_id').eq('user_id', user.id);
    const ids = saves?.map(s => s.post_id) || [];
    if (ids.length === 0) { setPosts([]); setLoading(false); return; }
    const { data } = await supabase.from('posts').select('*').in('id', ids).order('created_at', { ascending: false });
    if (data) {
      const userIds = [...new Set(data.map(p => p.user_id))];
      const { data: profs } = await supabase.from('profiles').select('user_id, name, avatar_url, username').in('user_id', userIds);
      const profMap = new Map(profs?.map(p => [p.user_id, p]) || []);
      setPosts(data.map(p => ({ ...p, user_name: profMap.get(p.user_id)?.name, user_avatar: profMap.get(p.user_id)?.avatar_url || undefined, user_username: profMap.get(p.user_id)?.username })));
    }
    const { data: likes } = await supabase.from('likes').select('post_id').eq('user_id', user.id);
    if (likes) setLikedIds(new Set(likes.map(l => l.post_id)));
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const toggleLike = async (postId: string) => {
    if (!user) return;
    const liked = likedIds.has(postId);
    setLikedIds(prev => { const s = new Set(prev); liked ? s.delete(postId) : s.add(postId); return s; });
    if (liked) await supabase.from('likes').delete().eq('user_id', user.id).eq('post_id', postId);
    else await supabase.from('likes').insert({ user_id: user.id, post_id: postId });
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="px-5 pt-14">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate({ to: '/more' })} className="neu-btn p-2"><ArrowLeft size={18} /></button>
          <Bookmark size={20} className="text-primary" />
          <h1 className="text-[22px] font-bold text-foreground">Saved</h1>
        </div>
        <div className="space-y-4">
          {loading ? <p className="text-center text-muted-foreground py-8">Loading...</p> :
           posts.length === 0 ? <p className="text-center text-muted-foreground py-8 text-[14px]">No saved posts yet</p> :
           posts.map(p => <PostCard key={p.id} post={p} isLiked={likedIds.has(p.id)} onToggleLike={() => toggleLike(p.id)} onOpenComments={() => setCommentsPostId(p.id)} onDelete={load} />)}
        </div>
      </div>
      {commentsPostId && <CommentsSheet postId={commentsPostId} onClose={() => setCommentsPostId(null)} />}
      <BottomNav />
    </div>
  );
}
