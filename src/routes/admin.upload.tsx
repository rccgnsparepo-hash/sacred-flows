import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { NeuInput } from '@/components/NeuInput';
import { NeuButton } from '@/components/NeuButton';
import { ArrowLeft, Upload, FileText, Youtube, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/admin/upload')({
  head: () => ({
    meta: [{ title: 'Upload Content — Church Hub' }],
  }),
  component: UploadPage,
});

function UploadPage() {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'PDF' | 'YOUTUBE'>('PDF');
  const [youtubeLink, setYoutubeLink] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) navigate({ to: '/home' });
  }, [user, isAdmin, isLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error('Title is required'); return; }
    if (type === 'YOUTUBE' && !youtubeLink.trim()) { toast.error('YouTube link is required'); return; }
    if (type === 'PDF' && !file) { toast.error('Please select a PDF file'); return; }

    setUploading(true);
    try {
      let fileUrl: string | null = null;

      if (type === 'PDF' && file) {
        const ext = file.name.split('.').pop();
        const path = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('church-files')
          .upload(path, file, { contentType: file.type });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('church-files').getPublicUrl(path);
        fileUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from('content').insert({
        title: title.trim(),
        description: description.trim() || null,
        type,
        file_url: fileUrl,
        youtube_link: type === 'YOUTUBE' ? youtubeLink.trim() : null,
        uploaded_by: user!.id,
      });

      if (error) throw error;
      toast.success('Content uploaded successfully!');
      // Reset form
      setTitle('');
      setDescription('');
      setYoutubeLink('');
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (isLoading || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="px-5 pt-14">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate({ to: '/admin' })} className="neu-btn p-3">
            <ArrowLeft size={18} className="text-foreground" />
          </button>
          <h1 className="text-[20px] font-bold text-foreground">Upload Content</h1>
        </div>

        <div className="flex gap-3 mb-6">
          {(['PDF', 'YOUTUBE'] as const).map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] font-semibold transition-all ${
                type === t ? 'neu-pressed text-primary' : 'neu-btn text-muted-foreground'
              }`}
            >
              {t === 'PDF' ? <FileText size={16} /> : <Youtube size={16} />}
              {t === 'PDF' ? 'PDF File' : 'YouTube'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <NeuInput label="Title" placeholder="Content title" value={title} onChange={e => setTitle(e.target.value)} />
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-foreground pl-1">Description</label>
            <textarea
              placeholder="Optional description..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-3.5 neu-input text-foreground text-[15px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          {type === 'YOUTUBE' ? (
            <NeuInput
              label="YouTube Link"
              placeholder="https://youtube.com/watch?v=..."
              value={youtubeLink}
              onChange={e => setYoutubeLink(e.target.value)}
            />
          ) : (
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground pl-1">PDF File</label>
              <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
              <button type="button" onClick={() => fileRef.current?.click()} className="w-full neu-card p-6 flex flex-col items-center gap-2">
                {file ? (
                  <>
                    <CheckCircle size={24} className="text-primary" />
                    <span className="text-[14px] text-primary font-medium">{file.name}</span>
                    <span className="text-[12px] text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  </>
                ) : (
                  <>
                    <Upload size={24} className="text-muted-foreground" />
                    <span className="text-[14px] text-muted-foreground">Tap to select PDF</span>
                  </>
                )}
              </button>
            </div>
          )}

          <div className="pt-2">
            <NeuButton type="submit" variant="primary" size="lg" isLoading={uploading}>
              Upload Content
            </NeuButton>
          </div>
        </form>
      </div>
    </div>
  );
}
