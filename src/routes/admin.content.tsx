import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SkeletonCard } from '@/components/SkeletonCard';
import { NeuButton } from '@/components/NeuButton';
import { NeuInput } from '@/components/NeuInput';
import { ArrowLeft, Trash2, FileText, Play, Edit2, X, Save } from 'lucide-react';
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
  youtube_link: string | null;
  file_url: string | null;
  created_at: string;
}

function ManageContentPage() {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) navigate({ to: '/home' });
  }, [user, isAdmin, isLoading, navigate]);

  const fetchContent = useCallback(async () => {
    const { data } = await supabase.from('content').select('id, title, description, type, youtube_link, file_url, created_at').order('created_at', { ascending: false });
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

  const startEdit = (item: ContentItem) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditDescription(item.description || '');
  };

  const handleSave = async () => {
    if (!editingId || !editTitle.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('content').update({
      title: editTitle.trim(),
      description: editDescription.trim() || null,
    }).eq('id', editingId);

    if (error) {
      toast.error('Failed to update');
    } else {
      setItems(prev => prev.map(i => i.id === editingId ? { ...i, title: editTitle.trim(), description: editDescription.trim() || null } : i));
      toast.success('Updated');
    }
    setSaving(false);
    setEditingId(null);
  };

  if (isLoading || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="px-5 pt-14">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate({ to: '/admin' })} className="neu-btn p-3">
            <ArrowLeft size={18} className="text-foreground" />
          </button>
          <h1 className="text-[20px] font-bold text-foreground">Manage Content ({items.length})</h1>
        </div>

        <div className="space-y-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
          ) : items.length === 0 ? (
            <p className="text-center text-muted-foreground py-16">No content yet</p>
          ) : (
            items.map(item => (
              <div key={item.id} className="neu-card p-4">
                {editingId === item.id ? (
                  <div className="space-y-3">
                    <NeuInput label="Title" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-medium text-foreground pl-1">Description</label>
                      <textarea
                        value={editDescription}
                        onChange={e => setEditDescription(e.target.value)}
                        rows={2}
                        className="w-full px-4 py-3 neu-input text-foreground text-[14px] placeholder:text-muted-foreground focus:outline-none resize-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingId(null)} className="neu-btn p-2.5 text-muted-foreground">
                        <X size={16} />
                      </button>
                      <button onClick={handleSave} disabled={saving} className="neu-btn p-2.5 text-primary">
                        <Save size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className={`neu-btn p-2.5 ${item.type === 'PDF' ? 'text-primary' : 'text-church-gold'}`}>
                      {item.type === 'PDF' ? <FileText size={16} /> : <Play size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-foreground line-clamp-1">{item.title}</p>
                      {item.description && (
                        <p className="text-[12px] text-muted-foreground line-clamp-1">{item.description}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-0.5">{new Date(item.created_at).toLocaleDateString()}</p>
                    </div>
                    <button onClick={() => startEdit(item)} className="neu-btn p-2.5 text-primary">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="neu-btn p-2.5 text-destructive">
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
