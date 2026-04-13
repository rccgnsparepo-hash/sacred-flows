import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { NeuButton } from '@/components/NeuButton';
import { ArrowLeft, FileText, Play, Download, Bookmark, BookmarkCheck } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/content/$id')({
  head: () => ({
    meta: [
      { title: 'Content — Church Hub' },
      { name: 'description', content: 'View church content' },
    ],
  }),
  component: ContentDetailPage,
});

interface ContentDetail {
  id: string;
  title: string;
  description: string | null;
  type: string;
  file_url: string | null;
  youtube_link: string | null;
  created_at: string;
}

function getYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/);
  return match?.[1] || null;
}

function ContentDetailPage() {
  const { id } = Route.useParams();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [item, setItem] = useState<ContentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: '/auth' });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const [contentRes, bmRes] = await Promise.all([
        supabase.from('content').select('*').eq('id', id).single(),
        supabase.from('bookmarks').select('id').eq('user_id', user.id).eq('content_id', id).maybeSingle(),
      ]);
      if (contentRes.data) setItem(contentRes.data as ContentDetail);
      setIsBookmarked(!!bmRes.data);
      setLoading(false);
    };
    fetch();
  }, [id, user]);

  const toggleBookmark = async () => {
    if (!user) return;
    if (isBookmarked) {
      await supabase.from('bookmarks').delete().eq('user_id', user.id).eq('content_id', id);
      setIsBookmarked(false);
      toast('Bookmark removed');
    } else {
      await supabase.from('bookmarks').insert({ user_id: user.id, content_id: id });
      setIsBookmarked(true);
      toast('Bookmarked!');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <p className="text-muted-foreground mb-4">Content not found</p>
        <Link to="/home" className="text-primary font-semibold">Go Home</Link>
      </div>
    );
  }

  const youtubeId = item.youtube_link ? getYoutubeId(item.youtube_link) : null;

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="px-5 pt-14">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate({ to: '/home' })} className="neu-btn p-3">
            <ArrowLeft size={18} className="text-foreground" />
          </button>
          <h1 className="text-[18px] font-bold text-foreground flex-1 line-clamp-1">{item.title}</h1>
          <button onClick={toggleBookmark} className="neu-btn p-3">
            {isBookmarked
              ? <BookmarkCheck size={18} className="text-church-gold" />
              : <Bookmark size={18} className="text-muted-foreground" />
            }
          </button>
        </div>

        {item.type === 'YOUTUBE' && youtubeId && (
          <div className="neu-card overflow-hidden mb-6">
            <div className="aspect-video">
              <iframe
                src={`https://www.youtube.com/embed/${youtubeId}`}
                title={item.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          </div>
        )}

        {item.type === 'PDF' && item.file_url && (
          <div className="neu-card p-6 mb-6 flex flex-col items-center gap-4">
            <div className="neu-convex p-5">
              <FileText size={36} className="text-primary" />
            </div>
            <p className="text-[14px] text-muted-foreground">PDF Document</p>
            <div className="flex gap-3 w-full">
              <NeuButton
                variant="primary"
                size="md"
                className="flex-1"
                onClick={() => window.open(item.file_url!, '_blank')}
              >
                <Play size={16} /> Open
              </NeuButton>
              <a href={item.file_url} download className="flex-1">
                <NeuButton variant="default" size="md" className="w-full">
                  <Download size={16} /> Download
                </NeuButton>
              </a>
            </div>
          </div>
        )}

        <div className="neu-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-[11px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full ${
              item.type === 'PDF'
                ? 'bg-primary/10 text-primary'
                : 'bg-church-gold/15 text-church-gold'
            }`}>
              {item.type === 'PDF' ? 'PDF' : 'Video'}
            </span>
            <span className="text-[12px] text-muted-foreground">
              {new Date(item.created_at).toLocaleDateString()}
            </span>
          </div>
          <h2 className="text-[17px] font-bold text-foreground mb-2">{item.title}</h2>
          {item.description && (
            <p className="text-[14px] text-muted-foreground leading-relaxed">{item.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}
