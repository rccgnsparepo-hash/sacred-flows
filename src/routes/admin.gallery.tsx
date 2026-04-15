import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { NeuInput } from '@/components/NeuInput';
import { NeuButton } from '@/components/NeuButton';
import { SkeletonCard } from '@/components/SkeletonCard';
import { ArrowLeft, Upload, Image, Trash2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/admin/gallery')({
  head: () => ({
    meta: [{ title: 'Gallery Management — Church Hub' }],
  }),
  component: GalleryManagePage,
});

interface GalleryItem {
  id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
}

function GalleryManagePage() {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) navigate({ to: '/home' });
  }, [user, isAdmin, isLoading, navigate]);

  const fetchGallery = useCallback(async () => {
    const { data } = await supabase.from('gallery').select('*').order('created_at', { ascending: false });
    if (data) setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchGallery(); }, [fetchGallery]);

  const handleUpload = async () => {
    if (files.length === 0) { toast.error('Select at least one image'); return; }
    setUploading(true);
    try {
      for (const file of files) {
        const ext = file.name.split('.').pop();
        const path = `gallery/${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('church-files').upload(path, file, { contentType: file.type });
        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage.from('church-files').getPublicUrl(path);

        const { error: insertErr } = await supabase.from('gallery').insert({
          image_url: urlData.publicUrl,
          caption: caption.trim() || null,
          uploaded_by: user!.id,
        });
        if (insertErr) throw insertErr;
      }

      toast.success(`${files.length} image(s) uploaded!`);
      setFiles([]);
      setCaption('');
      if (fileRef.current) fileRef.current.value = '';
      fetchGallery();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this gallery image?')) return;
    const { error } = await supabase.from('gallery').delete().eq('id', id);
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
          <h1 className="text-[20px] font-bold text-foreground">Gallery Management</h1>
        </div>

        {/* Upload form */}
        <div className="neu-card p-5 mb-6">
          <h3 className="text-[15px] font-semibold text-foreground mb-4">Upload Images</h3>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => setFiles(Array.from(e.target.files || []))}
          />
          <button onClick={() => fileRef.current?.click()} className="w-full neu-card-sm p-6 flex flex-col items-center gap-2 mb-4">
            {files.length > 0 ? (
              <>
                <CheckCircle size={24} className="text-primary" />
                <span className="text-[14px] text-primary font-medium">{files.length} image(s) selected</span>
              </>
            ) : (
              <>
                <Upload size={24} className="text-muted-foreground" />
                <span className="text-[14px] text-muted-foreground">Tap to select images</span>
              </>
            )}
          </button>
          <NeuInput label="Caption (optional)" placeholder="Add a caption..." value={caption} onChange={e => setCaption(e.target.value)} />
          <div className="mt-4">
            <NeuButton variant="primary" size="lg" isLoading={uploading} onClick={handleUpload}>
              Upload to Gallery
            </NeuButton>
          </div>
        </div>

        {/* Existing gallery items */}
        <h3 className="text-[16px] font-bold text-foreground mb-4">Gallery Items ({items.length})</h3>
        <div className="grid grid-cols-2 gap-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-square neu-card animate-pulse-soft" />
            ))
          ) : (
            items.map(item => (
              <div key={item.id} className="relative aspect-square rounded-2xl overflow-hidden neu-card-sm">
                <img src={item.image_url} alt={item.caption || ''} className="w-full h-full object-cover" loading="lazy" />
                <button
                  onClick={() => handleDelete(item.id)}
                  className="absolute top-2 right-2 p-2 bg-destructive rounded-full text-destructive-foreground"
                >
                  <Trash2 size={12} />
                </button>
                {item.caption && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/60 to-transparent p-2">
                    <p className="text-[11px] text-primary-foreground line-clamp-1">{item.caption}</p>
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
