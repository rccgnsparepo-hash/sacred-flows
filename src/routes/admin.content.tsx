import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SkeletonCard } from '@/components/SkeletonCard';
import { NeuButton } from '@/components/NeuButton';
import { ArrowLeft, Trash2, FileText, Play } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/admin/content')({
  head: () => ({
    meta: [{ title: 'Manage Content — Church Hub' }],
  }),
  component: ManageContentPage,
});

interface ContentItem {
  id: string;
  title: string;
  description: string | null;
  type: string;
  created_at: string;
}

function ManageContentPage() {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) navigate({ to: '/home' });
  }, [user, isAdmin, isLoading, navigate]);

  const fetchContent = useCallback(async () => {
    const { data } = await supabase.from('content').select('id, title, description, type, created_at').order('created_at', { ascending: false });
    if (data) setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchContent(); }, [fetchContent]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this content?')) return;
    const { error } = await supabase.from('content').delete().eq('id', id);
    if (error) { toast.error('Failed to delete'); return; }
    setItems(prev => prev.filter(i => i.id !== id));
    toast.success('Deleted');
  };

  if (isLoading || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="px-5 pt-14">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate({ to: '/admin' })} className="neu-btn p-3">
            <ArrowLeft size={18} className="text-foreground" />
          </button>
          <h1 className="text-[20px] font-bold text-foreground">Manage Content</h1>
        </div>

        <div className="space-y-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
          ) : items.length === 0 ? (
            <p className="text-center text-muted-foreground py-16">No content yet</p>
          ) : (
            items.map(item => (
              <div key={item.id} className="neu-card p-4 flex items-center gap-3">
                <div className={`neu-btn p-2.5 ${item.type === 'PDF' ? 'text-primary' : 'text-church-gold'}`}>
                  {item.type === 'PDF' ? <FileText size={16} /> : <Play size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-foreground line-clamp-1">{item.title}</p>
                  <p className="text-[12px] text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</p>
                </div>
                <button onClick={() => handleDelete(item.id)} className="neu-btn p-2.5 text-destructive">
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
