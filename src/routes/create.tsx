import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { NeuButton } from '@/components/NeuButton';
import { BottomNav } from '@/components/BottomNav';
import { ImageIcon, Video, Youtube, X, Send } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/create')({
  head: () => ({
    meta: [
      { title: 'Create Post — NSP App' },
      { name: 'description', content: 'Share something with your community' },
    ],
  }),
  component: CreatePostPage,
});

function CreatePostPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'youtube' | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) navigate({ to: '/auth' });
  }, [user, isLoading, navigate]);

  const handleFileSelect = (type: 'image' | 'video') => {
    setMediaType(type);
    fileRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = mediaType === 'video' ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`File must be under ${mediaType === 'video' ? '50MB' : '5MB'}`);
      return;
    }
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  };

  const clearMedia = () => {
    setMediaType(null);
    setMediaFile(null);
    setMediaPreview(null);
    setYoutubeUrl('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handlePost = async () => {
    if (!user) return;
    if (!text.trim() && !mediaFile && !youtubeUrl.trim()) {
      toast.error('Add some content to your post');
      return;
    }

    setPosting(true);
    try {
      let mediaUrl: string | null = null;
      let finalMediaType: string | null = mediaType;

      if (mediaFile && (mediaType === 'image' || mediaType === 'video')) {
        const ext = mediaFile.name.split('.').pop();
        const path = `posts/${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('church-files')
          .upload(path, mediaFile, { contentType: mediaFile.type });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('church-files').getPublicUrl(path);
        mediaUrl = urlData.publicUrl;
      } else if (mediaType === 'youtube' && youtubeUrl.trim()) {
        mediaUrl = youtubeUrl.trim();
        finalMediaType = 'youtube';
      }

      const { error } = await supabase.from('posts').insert({
        user_id: user.id,
        content_text: text.trim() || null,
        media_url: mediaUrl,
        media_type: finalMediaType,
      });

      if (error) throw error;
      toast.success('Posted! 🎉');
      navigate({ to: '/home' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to post');
    } finally {
      setPosting(false);
    }
  };

  if (isLoading) return null;

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="px-5 pt-14">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[22px] font-bold text-foreground">Create Post</h1>
          <button
            onClick={handlePost}
            disabled={posting || (!text.trim() && !mediaFile && !youtubeUrl.trim())}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-[14px] font-semibold disabled:opacity-50"
          >
            <Send size={16} />
            {posting ? 'Posting...' : 'Post'}
          </button>
        </div>

        {/* Text input */}
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="What's on your mind?"
          rows={4}
          maxLength={2000}
          className="w-full px-4 py-4 neu-input text-foreground text-[15px] placeholder:text-muted-foreground focus:outline-none resize-none mb-4"
        />

        {/* Media preview */}
        {mediaPreview && (
          <div className="relative mb-4 neu-card overflow-hidden">
            <button onClick={clearMedia} className="absolute top-3 right-3 z-10 p-2 bg-foreground/50 rounded-full">
              <X size={16} className="text-primary-foreground" />
            </button>
            {mediaType === 'image' ? (
              <img src={mediaPreview} alt="" className="w-full max-h-[300px] object-cover" />
            ) : (
              <video src={mediaPreview} controls className="w-full max-h-[300px]" />
            )}
          </div>
        )}

        {mediaType === 'youtube' && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Youtube size={16} className="text-destructive" />
              <span className="text-[13px] font-medium text-foreground">YouTube Link</span>
              <button onClick={clearMedia} className="ml-auto text-[12px] text-muted-foreground">Clear</button>
            </div>
            <input
              value={youtubeUrl}
              onChange={e => setYoutubeUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="w-full px-4 py-3 neu-input text-foreground text-[14px] placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
        )}

        {/* Media buttons */}
        {!mediaPreview && mediaType !== 'youtube' && (
          <div className="flex gap-3">
            <input
              ref={fileRef}
              type="file"
              accept={mediaType === 'video' ? 'video/*' : 'image/*'}
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={() => handleFileSelect('image')}
              className="flex-1 flex items-center justify-center gap-2 py-4 neu-card text-[14px] font-medium text-primary"
            >
              <ImageIcon size={20} /> Photo
            </button>
            <button
              onClick={() => handleFileSelect('video')}
              className="flex-1 flex items-center justify-center gap-2 py-4 neu-card text-[14px] font-medium text-primary"
            >
              <Video size={20} /> Video
            </button>
            <button
              onClick={() => setMediaType('youtube')}
              className="flex-1 flex items-center justify-center gap-2 py-4 neu-card text-[14px] font-medium text-destructive"
            >
              <Youtube size={20} /> YouTube
            </button>
          </div>
        )}

        <p className="text-[12px] text-muted-foreground text-right mt-3">{text.length}/2000</p>
      </div>

      <BottomNav />
    </div>
  );
}
