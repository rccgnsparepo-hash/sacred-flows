import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ContentCard } from '@/components/ContentCard';
import { SkeletonCard } from '@/components/SkeletonCard';
import { BottomNav } from '@/components/BottomNav';
import { Search, RefreshCw } from 'lucide-react';
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
  created_at: string;
}

function HomePage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [content, setContent] = useState<ContentItem[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: '/auth' });
  }, [user, authLoading, navigate]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [contentRes, bookmarkRes] = await Promise.all([
      supabase.from('content').select('id, title, description, type, created_at').order('created_at', { ascending: false }),
      supabase.from('bookmarks').select('content_id').eq('user_id', user.id),
    ]);
    if (contentRes.data) setContent(contentRes.data);
    if (bookmarkRes.data) setBookmarkedIds(new Set(bookmarkRes.data.map(b => b.content_id)));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
            <ContentCard
              key={item.id}
              id={item.id}
              title={item.title}
              description={item.description}
              type={item.type as 'PDF' | 'YOUTUBE'}
              isBookmarked={bookmarkedIds.has(item.id)}
              onToggleBookmark={() => toggleBookmark(item.id)}
            />
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}
