import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ContentCard } from '@/components/ContentCard';
import { SkeletonCard } from '@/components/SkeletonCard';
import { BottomNav } from '@/components/BottomNav';
import { Search, RefreshCw, Cake, Play } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/home')({
  head: () => ({
    meta: [
      { title: 'Home — Church Hub' },
      { name: 'description', content: 'Browse church content, sermons, and resources' },
    ],
  }),
  component: HomePage,
});

interface ContentItem {
  id: string;
  title: string;
  description: string | null;
  type: string;
  youtube_link: string | null;
  file_url: string | null;
  created_at: string;
}

interface BirthdayUser {
  name: string;
  avatar_url: string | null;
  date_of_birth: string;
  daysUntil: number;
}

function getYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return match ? match[1] : null;
}

function HomePage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [content, setContent] = useState<ContentItem[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [birthdays, setBirthdays] = useState<BirthdayUser[]>([]);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: '/auth' });
  }, [user, authLoading, navigate]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [contentRes, bookmarkRes, profilesRes] = await Promise.all([
      supabase.from('content').select('id, title, description, type, youtube_link, file_url, created_at').order('created_at', { ascending: false }),
      supabase.from('bookmarks').select('content_id').eq('user_id', user.id),
      supabase.from('profiles').select('name, avatar_url, date_of_birth'),
    ]);
    if (contentRes.data) setContent(contentRes.data);
    if (bookmarkRes.data) setBookmarkedIds(new Set(bookmarkRes.data.map(b => b.content_id)));

    // Calculate upcoming birthdays
    if (profilesRes.data) {
      const today = new Date();
      const upcoming: BirthdayUser[] = profilesRes.data
        .filter(p => p.date_of_birth)
        .map(p => {
          const dob = new Date(p.date_of_birth!);
          const thisYear = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
          if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1);
          const daysUntil = Math.ceil((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          return { name: p.name, avatar_url: p.avatar_url, date_of_birth: p.date_of_birth!, daysUntil };
        })
        .sort((a, b) => a.daysUntil - b.daysUntil)
        .slice(0, 5);
      setBirthdays(upcoming);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime content updates
  useEffect(() => {
    const channel = supabase
      .channel('content-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content' }, () => {
        fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const toggleBookmark = async (contentId: string) => {
    if (!user) return;
    const isBookmarked = bookmarkedIds.has(contentId);
    if (isBookmarked) {
      await supabase.from('bookmarks').delete().eq('user_id', user.id).eq('content_id', contentId);
      setBookmarkedIds(prev => { const s = new Set(prev); s.delete(contentId); return s; });
      toast('Bookmark removed');
    } else {
      await supabase.from('bookmarks').insert({ user_id: user.id, content_id: contentId });
      setBookmarkedIds(prev => new Set(prev).add(contentId));
      toast('Bookmarked!');
    }
  };

  const filtered = content.filter(c =>
    !search || c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.description?.toLowerCase().includes(search.toLowerCase())
  );

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="px-5 pt-14 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[22px] font-bold text-foreground">Church Hub</h1>
            <p className="text-[13px] text-muted-foreground">Explore content & resources</p>
          </div>
          <button onClick={handleRefresh} className="neu-btn p-3" disabled={refreshing}>
            <RefreshCw size={18} className={`text-muted-foreground ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="neu-input flex items-center gap-3 px-4 py-3 mb-6">
          <Search size={18} className="text-muted-foreground shrink-0" />
          <input
            placeholder="Search content..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent flex-1 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
      </div>

      {/* Birthday section */}
      {birthdays.length > 0 && !search && (
        <div className="px-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Cake size={16} className="text-church-gold" />
            <h2 className="text-[15px] font-bold text-foreground">Upcoming Birthdays</h2>
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

      {/* Content feed */}
      <div className="px-5 space-y-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-[15px]">
              {search ? 'No results found' : 'No content yet'}
            </p>
          </div>
        ) : (
          filtered.map(item => (
            <div key={item.id} className="slide-up">
              {/* YouTube thumbnail preview */}
              {item.type === 'YOUTUBE' && item.youtube_link && getYoutubeId(item.youtube_link) && (
                <div className="neu-card overflow-hidden mb-0 rounded-b-none">
                  <div className="relative aspect-video">
                    <img
                      src={`https://img.youtube.com/vi/${getYoutubeId(item.youtube_link)}/hqdefault.jpg`}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-foreground/20">
                      <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center">
                        <Play size={24} className="text-primary-foreground ml-1" fill="currentColor" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className={item.type === 'YOUTUBE' && item.youtube_link && getYoutubeId(item.youtube_link) ? 'neu-card rounded-t-none border-t-0' : ''}>
                <ContentCard
                  id={item.id}
                  title={item.title}
                  description={item.description}
                  type={item.type as 'PDF' | 'YOUTUBE'}
                  isBookmarked={bookmarkedIds.has(item.id)}
                  onToggleBookmark={() => toggleBookmark(item.id)}
                />
              </div>
            </div>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}
