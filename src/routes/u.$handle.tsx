import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BottomNav } from '@/components/BottomNav';
import { PostCard, type PostData } from '@/components/PostCard';
import { ArrowLeft, MessageCircle, UserPlus, UserCheck, X } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/u/$handle')({
  head: () => ({ meta: [{ title: 'Profile — NSP Socials' }] }),
  component: PublicProfile,
});

interface ProfileRow {
  user_id: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  followers_count: number;
  following_count: number;
}

function PublicProfile() {
  const { handle } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAvatar, setShowAvatar] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    // Try by username first, then by user_id (UUID)
    let { data: p } = await supabase.from('profiles').select('user_id, name, username, avatar_url, bio, followers_count, following_count').eq('username', handle).maybeSingle();
    if (!p) {
      ({ data: p } = await supabase.from('profiles').select('user_id, name, username, avatar_url, bio, followers_count, following_count').eq('user_id', handle).maybeSingle());
    }
    if (!p) { setLoading(false); return; }
    setProfile(p);

    const { data: postRows } = await supabase.from('posts').select('*').eq('user_id', p.user_id).order('created_at', { ascending: false }).limit(30);
    setPosts((postRows || []).map(r => ({ ...r, user_name: p!.name, user_avatar: p!.avatar_url || undefined, user_username: p!.username })));

    if (user && user.id !== p.user_id) {
      const { data: f } = await supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', p.user_id).maybeSingle();
      setIsFollowing(!!f);
    }
    setLoading(false);
  }, [handle, user]);

  useEffect(() => { load(); }, [load]);

  const toggleFollow = async () => {
    if (!user || !profile) return;
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', profile.user_id);
      setIsFollowing(false);
      setProfile(p => p ? { ...p, followers_count: Math.max(0, p.followers_count - 1) } : p);
    } else {
      const { error } = await supabase.from('follows').insert({ follower_id: user.id, following_id: profile.user_id });
      if (error) { toast.error('Failed to follow'); return; }
      setIsFollowing(true);
      setProfile(p => p ? { ...p, followers_count: p.followers_count + 1 } : p);
    }
  };

  const startChat = async () => {
    if (!user || !profile) return;
    const { data, error } = await supabase.rpc('get_or_create_conversation', { other_user_id: profile.user_id });
    if (error || !data) { toast.error('Could not open chat'); return; }
    navigate({ to: '/chat/$id', params: { id: data as string } });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!profile) return (
    <div className="min-h-screen bg-background pt-14 px-5">
      <button onClick={() => navigate({ to: '/home' })} className="neu-btn p-2 mb-4"><ArrowLeft size={18} /></button>
      <p className="text-center text-muted-foreground">User not found</p>
    </div>
  );

  const initials = profile.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  const isMe = user?.id === profile.user_id;

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="px-5 pt-14">
        <button onClick={() => window.history.back()} className="neu-btn p-2 mb-4"><ArrowLeft size={18} /></button>

        <div className="flex flex-col items-center mb-6">
          <button onClick={() => profile.avatar_url && setShowAvatar(true)} className="w-24 h-24 rounded-full neu-convex flex items-center justify-center overflow-hidden">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-primary">{initials}</span>
            )}
          </button>
          <h1 className="text-[20px] font-bold text-foreground mt-3">{profile.name}</h1>
          {profile.username && <p className="text-[13px] text-muted-foreground">@{profile.username}</p>}
          {profile.bio && <p className="text-[13px] text-foreground/80 mt-2 text-center max-w-[280px]">{profile.bio}</p>}

          <div className="flex gap-6 mt-4">
            <div className="text-center">
              <p className="text-[16px] font-bold text-foreground">{posts.length}</p>
              <p className="text-[11px] text-muted-foreground">Posts</p>
            </div>
            <div className="text-center">
              <p className="text-[16px] font-bold text-foreground">{profile.followers_count}</p>
              <p className="text-[11px] text-muted-foreground">Followers</p>
            </div>
            <div className="text-center">
              <p className="text-[16px] font-bold text-foreground">{profile.following_count}</p>
              <p className="text-[11px] text-muted-foreground">Following</p>
            </div>
          </div>

          {!isMe && user && (
            <div className="flex gap-3 mt-4 w-full max-w-xs">
              <button onClick={toggleFollow} className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-1.5 ${isFollowing ? 'neu-btn text-foreground' : 'bg-primary text-primary-foreground'}`}>
                {isFollowing ? <><UserCheck size={14} /> Following</> : <><UserPlus size={14} /> Follow</>}
              </button>
              <button onClick={startChat} className="flex-1 neu-btn py-2.5 text-[13px] font-semibold text-primary flex items-center justify-center gap-1.5">
                <MessageCircle size={14} /> Message
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-[15px] font-bold text-foreground">Posts</h2>
          {posts.length === 0 ? (
            <p className="text-center text-muted-foreground text-[13px] py-6">No posts yet</p>
          ) : posts.map(p => (
            <PostCard key={p.id} post={p} isLiked={false} onToggleLike={() => {}} onOpenComments={() => {}} />
          ))}
        </div>
      </div>

      {showAvatar && profile.avatar_url && (
        <div onClick={() => setShowAvatar(false)} className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4">
          <button className="absolute top-6 right-6 p-2 text-white"><X size={24} /></button>
          <img src={profile.avatar_url} alt={profile.name} className="max-w-full max-h-full rounded-2xl" />
        </div>
      )}

      <BottomNav />
    </div>
  );
}
