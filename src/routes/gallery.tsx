import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BottomNav } from '@/components/BottomNav';
import { SkeletonCard } from '@/components/SkeletonCard';
import { Image, X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/gallery')({
  head: () => ({
    meta: [
      { title: 'Gallery — NSP App' },
      { name: 'description', content: 'Community photo gallery' },
    ],
  }),
  component: GalleryPage,
});

interface GalleryItem {
  id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
}

function GalleryPage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: '/auth' });
  }, [user, authLoading, navigate]);

  const fetchGallery = useCallback(async () => {
    const { data } = await supabase
      .from('gallery')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchGallery(); }, [fetchGallery]);

  useEffect(() => {
    const channel = supabase
      .channel('gallery-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gallery' }, () => {
        fetchGallery();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchGallery]);

  const goNext = () => {
    if (selectedIndex !== null && selectedIndex < items.length - 1) setSelectedIndex(selectedIndex + 1);
  };
  const goPrev = () => {
    if (selectedIndex !== null && selectedIndex > 0) setSelectedIndex(selectedIndex - 1);
  };

  const handleDownload = async (imageUrl: string, caption: string | null) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = caption ? `${caption.replace(/[^a-z0-9]/gi, '_')}.jpg` : 'image.jpg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Image downloaded!');
    } catch {
      toast.error('Download failed');
    }
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="px-5 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="neu-convex p-3">
            <Image size={20} className="text-church-gold" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-foreground">Gallery</h1>
            <p className="text-[13px] text-muted-foreground">Community photos & moments</p>
          </div>
        </div>
      </div>

      {/* Featured carousel */}
      {!loading && items.length > 0 && (
        <div className="px-5 mb-6">
          <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-hide">
            {items.slice(0, 8).map((item, idx) => (
              <button
                key={item.id}
                onClick={() => setSelectedIndex(idx)}
                className="shrink-0 w-64 h-40 rounded-2xl overflow-hidden neu-card-sm snap-center"
              >
                <img src={item.image_url} alt={item.caption || ''} className="w-full h-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="px-5">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-square neu-card animate-pulse-soft" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <Image size={40} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-[15px]">No photos yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((item, idx) => (
              <div key={item.id} className="relative group">
                <button
                  onClick={() => setSelectedIndex(idx)}
                  className="aspect-square w-full rounded-2xl overflow-hidden neu-card-sm"
                >
                  <img src={item.image_url} alt={item.caption || ''} className="w-full h-full object-cover" loading="lazy" />
                  {item.caption && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/60 to-transparent p-3">
                      <p className="text-[12px] text-primary-foreground line-clamp-1">{item.caption}</p>
                    </div>
                  )}
                </button>
                <button
                  onClick={() => handleDownload(item.image_url, item.caption)}
                  className="absolute top-2 right-2 p-1.5 bg-background/70 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Download size={14} className="text-foreground" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen viewer */}
      {selectedIndex !== null && items[selectedIndex] && (
        <div className="fixed inset-0 z-50 bg-foreground/90 flex flex-col items-center justify-center fade-in" onClick={() => setSelectedIndex(null)}>
          <div className="absolute top-12 right-5 flex gap-3 z-10">
            <button
              onClick={(e) => { e.stopPropagation(); handleDownload(items[selectedIndex].image_url, items[selectedIndex].caption); }}
              className="p-3 bg-background/20 rounded-full backdrop-blur-sm"
            >
              <Download size={20} className="text-primary-foreground" />
            </button>
            <button className="p-3 text-primary-foreground">
              <X size={24} />
            </button>
          </div>

          <div className="relative w-full max-w-lg px-4" onClick={e => e.stopPropagation()}>
            <img
              src={items[selectedIndex].image_url}
              alt={items[selectedIndex].caption || ''}
              className="w-full max-h-[70vh] object-contain rounded-2xl"
            />

            {selectedIndex > 0 && (
              <button onClick={goPrev} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-background/20 rounded-full backdrop-blur-sm">
                <ChevronLeft size={24} className="text-primary-foreground" />
              </button>
            )}
            {selectedIndex < items.length - 1 && (
              <button onClick={goNext} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-background/20 rounded-full backdrop-blur-sm">
                <ChevronRight size={24} className="text-primary-foreground" />
              </button>
            )}
          </div>

          {items[selectedIndex].caption && (
            <p className="text-primary-foreground text-[15px] mt-4 px-8 text-center">{items[selectedIndex].caption}</p>
          )}
          <p className="text-primary-foreground/50 text-[12px] mt-2">
            {selectedIndex + 1} / {items.length}
          </p>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
