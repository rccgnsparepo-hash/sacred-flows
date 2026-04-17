import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';

interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  created_at: string;
  user_name?: string;
  user_avatar?: string | null;
}

export function StoriesBar() {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [viewing, setViewing] = useState<{ stories: Story[]; idx: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase.from('stories').select('*').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false });
    if (!data) return;
    const userIds = [...new Set(data.map(s => s.user_id))];
    const { data: profs } = await supabase.from('profiles').select('user_id, name, avatar_url').in('user_id', userIds);
    const profMap = new Map(profs?.map(p => [p.user_id, p]) || []);
    setStories(data.map(s => ({ ...s, user_name: profMap.get(s.user_id)?.name, user_avatar: profMap.get(s.user_id)?.avatar_url })));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const ch = supabase.channel('stories-bar').on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Auto-advance story view
  useEffect(() => {
    if (!viewing) return;
    const t = setTimeout(() => {
      if (viewing.idx + 1 < viewing.stories.length) setViewing({ ...viewing, idx: viewing.idx + 1 });
      else setViewing(null);
    }, 5000);
    return () => clearTimeout(t);
  }, [viewing]);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 20 * 1024 * 1024) { toast.error('Max 20MB'); return; }
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `stories/${user.id}/${Date.now()}.${ext}`;
    const { error: up } = await supabase.storage.from('church-files').upload(path, file, { contentType: file.type });
    if (up) { toast.error('Upload failed'); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('church-files').getPublicUrl(path);
    const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
    await supabase.from('stories').insert({ user_id: user.id, media_url: publicUrl, media_type: mediaType });
    toast.success('Story posted!');
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  // Group stories by user
  const grouped = stories.reduce((acc, s) => {
    if (!acc[s.user_id]) acc[s.user_id] = [];
    acc[s.user_id].push(s);
    return acc;
  }, {} as Record<string, Story[]>);
  const groups = Object.values(grouped);

  return (
    <>
      <div className="flex gap-3 overflow-x-auto px-5 py-3 scrollbar-hide">
        {/* Add story */}
        <div className="shrink-0 flex flex-col items-center w-16">
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className="w-14 h-14 rounded-full neu-convex flex items-center justify-center relative">
            <Plus size={20} className="text-primary" />
            <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={upload} />
          </button>
          <p className="text-[10px] text-muted-foreground mt-1">Your story</p>
        </div>

        {groups.map(g => (
          <button key={g[0].user_id} onClick={() => setViewing({ stories: g, idx: 0 })} className="shrink-0 flex flex-col items-center w-16">
            <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr from-primary via-pink-500 to-orange-400">
              <div className="w-full h-full rounded-full overflow-hidden bg-background flex items-center justify-center">
                {g[0].user_avatar ? (
                  <img src={g[0].user_avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold text-primary text-sm">{g[0].user_name?.charAt(0).toUpperCase()}</span>
                )}
              </div>
            </div>
            <p className="text-[10px] text-foreground mt-1 truncate w-16 text-center">{g[0].user_name?.split(' ')[0] || 'User'}</p>
          </button>
        ))}
      </div>

      {viewing && (
        <div onClick={() => setViewing(null)} className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
          <button className="absolute top-6 right-6 z-10 p-2 text-white"><X size={24} /></button>
          <div className="absolute top-4 left-4 right-16 flex gap-1">
            {viewing.stories.map((_, i) => (
              <div key={i} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
                <div className={`h-full bg-white ${i < viewing.idx ? 'w-full' : i === viewing.idx ? 'w-full transition-all duration-[5000ms] ease-linear' : 'w-0'}`} style={i === viewing.idx ? { animation: 'storyProgress 5s linear forwards' } : undefined} />
              </div>
            ))}
          </div>
          <div className="absolute top-8 left-4 flex items-center gap-2 z-10">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-white/20">
              {viewing.stories[viewing.idx].user_avatar && <img src={viewing.stories[viewing.idx].user_avatar!} alt="" className="w-full h-full object-cover" />}
            </div>
            <span className="text-white text-[13px] font-semibold">{viewing.stories[viewing.idx].user_name}</span>
          </div>
          <div onClick={e => e.stopPropagation()} className="max-w-full max-h-full">
            {viewing.stories[viewing.idx].media_type === 'video' ? (
              <video src={viewing.stories[viewing.idx].media_url} autoPlay playsInline controls className="max-h-screen max-w-full" />
            ) : (
              <img src={viewing.stories[viewing.idx].media_url} alt="" className="max-h-screen max-w-full object-contain" />
            )}
          </div>
        </div>
      )}
    </>
  );
}
