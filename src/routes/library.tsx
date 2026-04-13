import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ContentCard } from '@/components/ContentCard';
import { SkeletonCard } from '@/components/SkeletonCard';
import { BottomNav } from '@/components/BottomNav';
import { BookOpen } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/library')({
  head: () => ({
    meta: [
      { title: 'Library — Church Hub' },
      { name: 'description', content: 'Your bookmarked church content' },
    ],
  }),
  component: LibraryPage,
});

interface BookmarkedContent {
  id: string;
  title: string;
  description: string | null;
  type: string;
}

function LibraryPage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<BookmarkedContent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: '/auth' });
  }, [user, authLoading, navigate]);

  const fetchBookmarks = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('bookmarks')
      .select('content_id, content(id, title, description, type)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setItems(data.map((b: any) => b.content).filter(Boolean));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchBookmarks(); }, [fetchBookmarks]);

  const removeBookmark = async (contentId: string) => {
    if (!user) return;
    await supabase.from('bookmarks').delete().eq('user_id', user.id).eq('content_id', contentId);
    setItems(prev => prev.filter(i => i.id !== contentId));
    toast('Bookmark removed');
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="px-5 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="neu-convex p-3">
            <BookOpen size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-foreground">My Library</h1>
            <p className="text-[13px] text-muted-foreground">Your bookmarked content</p>
          </div>
        </div>
      </div>

      <div className="px-5 space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-[15px]">No bookmarks yet</p>
            <p className="text-muted-foreground text-[13px] mt-1">Bookmark content from the home page</p>
          </div>
        ) : (
          items.map(item => (
            <ContentCard
              key={item.id}
              id={item.id}
              title={item.title}
              description={item.description}
              type={item.type as 'PDF' | 'YOUTUBE'}
              isBookmarked={true}
              onToggleBookmark={() => removeBookmark(item.id)}
            />
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}
