import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BottomNav } from '@/components/BottomNav';
import { Heart, MessageCircle, Share2, Play, Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/videos')({
  head: () => ({
    meta: [
      { title: 'Videos — NSP App' },
      { name: 'description', content: 'Watch community videos' },
    ],
  }),
  component: VideosPage,
});

interface VideoPost {
  id: string;
  user_id: string;
  content_text: string | null;
  media_url: string;
  media_type: string;
  like_count: number;
  comment_count: number;
  created_at: string;
  user_name?: string;
  user_avatar?: string;
}

function getYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return match ? match[1] : null;
}

function VideosPage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [videos, setVideos] = useState<VideoPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: '/auth' });
  }, [user, authLoading, navigate]);

  const fetchVideos = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('posts')
      .select('*')
      .in('media_type', ['video', 'youtube'])
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) {
      const userIds = [...new Set(data.map(p => p.user_id))];
      const { data: profiles } = await supabase
        .from('profiles').select('user_id, name, avatar_url').in('user_id', userIds);
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      setVideos(data.filter(v => v.media_url && v.media_type).map(v => ({
        ...v,
        media_url: v.media_url!,
        media_type: v.media_type!,
        user_name: profileMap.get(v.user_id)?.name || 'User',
        user_avatar: profileMap.get(v.user_id)?.avatar_url || undefined,
      })));
    }

    const { data: likes } = await supabase.from('likes').select('post_id').eq('user_id', user.id);
    if (likes) setLikedIds(new Set(likes.map(l => l.post_id)));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  const toggleLike = async (postId: string) => {
    if (!user) return;
    const isLiked = likedIds.has(postId);
    setLikedIds(prev => { const s = new Set(prev); isLiked ? s.delete(postId) : s.add(postId); return s; });
    setVideos(prev => prev.map(v => v.id === postId ? { ...v, like_count: v.like_count + (isLiked ? -1 : 1) } : v));
    if (isLiked) {
      await supabase.from('likes').delete().eq('user_id', user.id).eq('post_id', postId);
    } else {
      await supabase.from('likes').insert({ user_id: user.id, post_id: postId });
    }
  };

  // Snap scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const idx = Math.round(container.scrollTop / container.clientHeight);
      setCurrentIndex(idx);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  if (authLoading) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="min-h-screen bg-background pb-28">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Play size={48} className="text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-[15px]">No videos yet</p>
          <p className="text-muted-foreground text-[13px] mt-1">Post a video to get started!</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-foreground">
      <div
        ref={containerRef}
        className="h-screen overflow-y-auto snap-y snap-mandatory"
        style={{ scrollBehavior: 'smooth' }}
      >
        {videos.map((video, idx) => {
          const videoId = video.media_type === 'youtube' ? getYoutubeId(video.media_url) : null;
          return (
            <div key={video.id} className="h-screen snap-start relative flex items-center justify-center bg-foreground">
              {/* Video content */}
              {video.media_type === 'video' ? (
                <video
                  src={video.media_url}
                  className="w-full h-full object-contain"
                  controls={false}
                  playsInline
                  muted
                  autoPlay={idx === currentIndex}
                  loop
                />
              ) : videoId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}?autoplay=${idx === currentIndex ? 1 : 0}&mute=1&loop=1&playlist=${videoId}&controls=0&rel=0`}
                  className="w-full h-full"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              ) : null}

              {/* Overlay UI */}
              <div className="absolute bottom-24 right-4 flex flex-col items-center gap-5">
                <button onClick={() => toggleLike(video.id)} className="flex flex-col items-center">
                  <Heart size={28} className={likedIds.has(video.id) ? 'fill-destructive text-destructive' : 'text-primary-foreground'} />
                  <span className="text-[12px] text-primary-foreground mt-1">{video.like_count}</span>
                </button>
                <div className="flex flex-col items-center">
                  <MessageCircle size={28} className="text-primary-foreground" />
                  <span className="text-[12px] text-primary-foreground mt-1">{video.comment_count}</span>
                </div>
              </div>

              {/* Bottom info */}
              <div className="absolute bottom-24 left-4 right-16">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center overflow-hidden">
                    {video.user_avatar ? (
                      <img src={video.user_avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[11px] font-bold text-primary-foreground">{video.user_name?.charAt(0)}</span>
                    )}
                  </div>
                  <span className="text-[14px] font-semibold text-primary-foreground">{video.user_name}</span>
                </div>
                {video.content_text && (
                  <p className="text-[13px] text-primary-foreground/90 line-clamp-2">{video.content_text}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
}
