import { useState, useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { Heart, MessageCircle, Share2, MoreHorizontal, Trash2, Play, Bookmark, Flag, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface PostData {
  id: string;
  user_id: string;
  content_text: string | null;
  media_url: string | null;
  media_urls?: string[] | null;
  media_type: string | null;
  like_count: number;
  comment_count: number;
  is_featured: boolean;
  created_at: string;
  user_name?: string;
  user_avatar?: string;
  user_username?: string | null;
  is_admin_post?: boolean;
}

interface PostCardProps {
  post: PostData;
  isLiked: boolean;
  onToggleLike: () => void;
  onOpenComments: () => void;
  onDelete?: () => void;
}

function getYoutubeId(url: string): string | null {
  if (!url) return null;
  // Handle: youtu.be/ID, youtube.com/watch?v=ID, /embed/ID, /shorts/ID, /live/ID, /v/ID, with extra params
  const patterns = [
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /^([A-Za-z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function PostCard({ post, isLiked, onToggleLike, onOpenComments, onDelete }: PostCardProps) {
  const { user, isAdmin } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [saved, setSaved] = useState(false);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const isOwner = user?.id === post.user_id;
  const videoId = post.media_type === 'youtube' && post.media_url ? getYoutubeId(post.media_url) : null;
  const carousel = post.media_urls && post.media_urls.length > 1 ? post.media_urls : null;

  useEffect(() => {
    if (!user) return;
    supabase.from('saves').select('id').eq('user_id', user.id).eq('post_id', post.id).maybeSingle()
      .then(({ data }) => setSaved(!!data));
  }, [user, post.id]);

  const handleShare = async () => {
    const url = `${window.location.origin}/home`;
    if (navigator.share) {
      try { await navigator.share({ title: post.content_text || 'NSP Socials', url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast('Link copied!');
    }
  };

  const toggleSave = async () => {
    if (!user) return;
    if (saved) {
      await supabase.from('saves').delete().eq('user_id', user.id).eq('post_id', post.id);
      setSaved(false);
      toast('Removed from saved');
    } else {
      await supabase.from('saves').insert({ user_id: user.id, post_id: post.id });
      setSaved(true);
      toast('Saved!');
    }
  };

  const reportPost = async () => {
    if (!user) return;
    const reason = prompt('Why are you reporting this post?');
    if (!reason?.trim()) return;
    await supabase.from('reports').insert({ reporter_id: user.id, post_id: post.id, reason: reason.trim() });
    toast.success('Report submitted');
    setShowMenu(false);
  };

  const profileLink = post.user_username || post.user_id;

  return (
    <div className="neu-card overflow-hidden slide-up">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 pb-2">
        <Link to="/u/$handle" params={{ handle: profileLink }} className="w-10 h-10 rounded-full neu-convex flex items-center justify-center shrink-0 overflow-hidden">
          {post.user_avatar ? (
            <img src={post.user_avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[13px] font-bold text-primary">
              {post.user_name?.charAt(0).toUpperCase() || 'U'}
            </span>
          )}
        </Link>
        <Link to="/u/$handle" params={{ handle: profileLink }} className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-foreground flex items-center gap-1.5">
            {post.user_name || 'User'}
            {post.is_admin_post && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-church-gold/15 text-church-gold font-bold">ADMIN</span>}
          </p>
          <p className="text-[11px] text-muted-foreground">{timeAgo(post.created_at)}</p>
        </Link>
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-2 text-muted-foreground">
            <MoreHorizontal size={18} />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full z-20 neu-card p-2 min-w-[140px]">
              {!isOwner && (
                <button onClick={reportPost} className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-foreground rounded-lg hover:bg-foreground/5">
                  <Flag size={14} /> Report
                </button>
              )}
              {(isOwner || isAdmin) && (
                <button
                  onClick={() => { setShowMenu(false); onDelete?.(); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-destructive rounded-lg hover:bg-destructive/10"
                >
                  <Trash2 size={14} /> Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {post.content_text && (
        <p className="px-4 pb-3 text-[14px] text-foreground leading-relaxed whitespace-pre-wrap">{post.content_text}</p>
      )}

      {carousel && (
        <div className="relative bg-foreground/5">
          <div className="overflow-hidden">
            <div className="flex transition-transform duration-300 ease-out" style={{ transform: `translateX(-${carouselIdx * 100}%)` }}>
              {carousel.map((url, i) => (
                <div key={i} className="w-full shrink-0">
                  {url.match(/\.(mp4|webm|mov)$/i) ? (
                    <video src={url} controls playsInline className="w-full max-h-[500px] bg-foreground/5" />
                  ) : (
                    <img src={url} alt="" className="w-full max-h-[500px] object-cover" loading="lazy" />
                  )}
                </div>
              ))}
            </div>
          </div>
          {carouselIdx > 0 && (
            <button onClick={() => setCarouselIdx(i => i - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 backdrop-blur shadow">
              <ChevronLeft size={18} />
            </button>
          )}
          {carouselIdx < carousel.length - 1 && (
            <button onClick={() => setCarouselIdx(i => i + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 backdrop-blur shadow">
              <ChevronRight size={18} />
            </button>
          )}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {carousel.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === carouselIdx ? 'bg-primary w-4' : 'bg-background/60 w-1.5'}`} />
            ))}
          </div>
        </div>
      )}

      {!carousel && post.media_type === 'image' && post.media_url && (
        <img src={post.media_url} alt="" className="w-full max-h-[500px] object-cover" loading="lazy" />
      )}

      {!carousel && post.media_type === 'video' && post.media_url && (
        <video src={post.media_url} controls playsInline preload="metadata" className="w-full max-h-[500px] bg-foreground/5" />
      )}

      {!carousel && post.media_type === 'youtube' && videoId && (
        <div className="relative aspect-video bg-black">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`}
            title="YouTube video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 w-full h-full"
          />
        </div>
      )}

      {!carousel && post.media_type === 'youtube' && post.media_url && !videoId && (
        <a href={post.media_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 mx-4 mb-3 px-4 py-3 neu-btn text-[13px] text-primary font-medium">
          <Play size={16} /> Watch on YouTube
        </a>
      )}

      <div className="flex items-center gap-1 px-4 py-3 border-t border-border/50">
        <button onClick={onToggleLike} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${isLiked ? 'text-destructive' : 'text-muted-foreground'}`}>
          <Heart size={18} className={isLiked ? 'fill-destructive' : ''} />
          {post.like_count > 0 && post.like_count}
        </button>
        <button onClick={onOpenComments} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium text-muted-foreground">
          <MessageCircle size={18} />
          {post.comment_count > 0 && post.comment_count}
        </button>
        <button onClick={handleShare} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium text-muted-foreground">
          <Share2 size={18} />
        </button>
        <button onClick={toggleSave} className={`ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${saved ? 'text-primary' : 'text-muted-foreground'}`}>
          <Bookmark size={18} className={saved ? 'fill-primary' : ''} />
        </button>
      </div>
    </div>
  );
}
