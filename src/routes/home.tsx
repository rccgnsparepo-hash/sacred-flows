import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PostCard, type PostData } from '@/components/PostCard';
import { CommentsSheet } from '@/components/CommentsSheet';
import { SkeletonCard } from '@/components/SkeletonCard';
import { BottomNav } from '@/components/BottomNav';
import { StoriesBar } from '@/components/StoriesBar';
import { Cake, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/home')({
  head: () => ({
    meta: [
      { title: 'Home — NSP App' },
      { name: 'description', content: 'Your community feed' },
    ],
  }),
  component: HomePage,
});

const PAGE_SIZE = 10;

interface BirthdayUser {
  name: string;
  avatar_url: string | null;
  daysUntil: number;
}

function HomePage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostData[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [birthdays, setBirthdays] = useState<BirthdayUser[]>([]);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: '/auth' });
  }, [user, authLoading, navigate]);

  const fetchPosts = useCallback(async (offset = 0, append = false) => {
    if (!user) return;

    const { data: postsData } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (postsData) {
      const userIds = [...new Set(postsData.map(p => p.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, avatar_url, username')
        .in('user_id', userIds);
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const enriched: PostData[] = postsData.map(p => ({
        ...p,
        user_name: profileMap.get(p.user_id)?.name || 'User',
        user_avatar: profileMap.get(p.user_id)?.avatar_url || undefined,
        user_username: profileMap.get(p.user_id)?.username || null,
      }));

      if (append) {
        setPosts(prev => [...prev, ...enriched]);
      } else {
        setPosts(enriched);
      }
      setHasMore(postsData.length === PAGE_SIZE);
      offsetRef.current = offset + postsData.length;
    }
  }, [user]);

  const fetchLikes = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('likes')
      .select('post_id')
      .eq('user_id', user.id);
    if (data) setLikedIds(new Set(data.map(l => l.post_id)));
  }, [user]);

  const fetchBirthdays = useCallback(async () => {
    const { data: profilesData } = await supabase.from('profiles').select('name, avatar_url, date_of_birth');
    if (profilesData) {
      const today = new Date();
      const upcoming: BirthdayUser[] = profilesData
        .filter(p => p.date_of_birth)
        .map(p => {
          const dob = new Date(p.date_of_birth!);
          const thisYear = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
          if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1);
          const daysUntil = Math.ceil((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          return { name: p.name, avatar_url: p.avatar_url, daysUntil };
        })
        .sort((a, b) => a.daysUntil - b.daysUntil)
        .slice(0, 5);
      setBirthdays(upcoming);
    }
  }, []);

  const initialLoad = useCallback(async () => {
    await Promise.all([fetchPosts(0), fetchLikes(), fetchBirthdays()]);
    setLoading(false);
  }, [fetchPosts, fetchLikes, fetchBirthdays]);

  useEffect(() => { initialLoad(); }, [initialLoad]);

  // Realtime for new posts
  useEffect(() => {
    const channel = supabase
      .channel('posts-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => {
        fetchPosts(0);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchPosts]);

  // Infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          setLoadingMore(true);
          fetchPosts(offsetRef.current, true).then(() => setLoadingMore(false));
        }
      },
      { threshold: 0.1 }
    );
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, fetchPosts]);

  const handleRefresh = async () => {
    setRefreshing(true);
    offsetRef.current = 0;
    await Promise.all([fetchPosts(0), fetchLikes()]);
    setRefreshing(false);
  };

  const toggleLike = async (postId: string) => {
    if (!user) return;
    const isLiked = likedIds.has(postId);
    // Optimistic update
    setLikedIds(prev => {
      const s = new Set(prev);
      isLiked ? s.delete(postId) : s.add(postId);
      return s;
    });
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, like_count: p.like_count + (isLiked ? -1 : 1) } : p
    ));

    if (isLiked) {
      await supabase.from('likes').delete().eq('user_id', user.id).eq('post_id', postId);
    } else {
      await supabase.from('likes').insert({ user_id: user.id, post_id: postId });
    }
  };

  const deletePost = async (postId: string) => {
    if (!confirm('Delete this post?')) return;
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (!error) {
      setPosts(prev => prev.filter(p => p.id !== postId));
      toast('Post deleted');
    }
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="px-5 pt-14 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[22px] font-bold text-foreground">NSP App</h1>
            <p className="text-[13px] text-muted-foreground">Your community feed</p>
          </div>
          <button onClick={handleRefresh} className="neu-btn p-3" disabled={refreshing}>
            <RefreshCw size={18} className={`text-muted-foreground ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <StoriesBar />

      {/* Birthdays */}
      {birthdays.length > 0 && (
        <div className="px-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Cake size={16} className="text-church-gold" />
            <h2 className="text-[14px] font-bold text-foreground">Upcoming Birthdays</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {birthdays.map((b, i) => (
              <div key={i} className="shrink-0 neu-card-sm p-3 flex flex-col items-center w-20">
                <div className="w-10 h-10 rounded-full neu-convex flex items-center justify-center overflow-hidden mb-1">
                  {b.avatar_url ? (
                    <img src={b.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[11px] font-bold text-primary">{b.name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <p className="text-[11px] font-medium text-foreground text-center line-clamp-1">{b.name.split(' ')[0]}</p>
                <p className="text-[10px] text-church-gold font-semibold">
                  {b.daysUntil === 0 ? '🎂 Today!' : b.daysUntil === 1 ? 'Tomorrow' : `${b.daysUntil}d`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feed */}
      <div className="px-5 space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
        ) : posts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-[15px]">No posts yet</p>
            <p className="text-muted-foreground text-[13px] mt-1">Be the first to share something!</p>
          </div>
        ) : (
          posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              isLiked={likedIds.has(post.id)}
              onToggleLike={() => toggleLike(post.id)}
              onOpenComments={() => setCommentsPostId(post.id)}
              onDelete={() => deletePost(post.id)}
            />
          ))
        )}

        {/* Infinite scroll trigger */}
        <div ref={loaderRef} className="h-10 flex items-center justify-center">
          {loadingMore && (
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      </div>

      {/* Comments sheet */}
      {commentsPostId && (
        <CommentsSheet postId={commentsPostId} onClose={() => setCommentsPostId(null)} />
      )}

      <BottomNav />
    </div>
  );
}
