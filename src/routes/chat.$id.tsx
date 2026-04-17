import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Send, Image as ImageIcon, Check, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/chat/$id')({
  head: () => ({ meta: [{ title: 'Chat — NSP Socials' }] }),
  component: ChatRoom,
});

interface DM {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  is_read: boolean;
  created_at: string;
}

function ChatRoom() {
  const { id } = Route.useParams();
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [other, setOther] = useState<{ user_id: string; name: string; avatar_url: string | null } | null>(null);
  const [messages, setMessages] = useState<DM[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!isLoading && !user) navigate({ to: '/auth' }); }, [user, isLoading, navigate]);

  const loadConv = useCallback(async () => {
    if (!user) return;
    const { data: conv } = await supabase.from('conversations').select('*').eq('id', id).maybeSingle();
    if (!conv) { toast.error('Conversation not found'); navigate({ to: '/chat' }); return; }
    const otherId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id;
    const { data: prof } = await supabase.from('profiles').select('user_id, name, avatar_url').eq('user_id', otherId).maybeSingle();
    if (prof) setOther(prof);
  }, [id, user, navigate]);

  const loadMessages = useCallback(async () => {
    const { data } = await supabase.from('dm_messages').select('*').eq('conversation_id', id).order('created_at', { ascending: true }).limit(200);
    if (data) setMessages(data);
  }, [id]);

  const markRead = useCallback(async () => {
    if (!user) return;
    await supabase.from('dm_messages').update({ is_read: true }).eq('conversation_id', id).neq('sender_id', user.id).eq('is_read', false);
  }, [id, user]);

  useEffect(() => { loadConv(); loadMessages(); }, [loadConv, loadMessages]);
  useEffect(() => { if (messages.length) markRead(); }, [messages.length, markRead]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    const ch = supabase.channel(`dm-${id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'dm_messages', filter: `conversation_id=eq.${id}` }, () => loadMessages()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, loadMessages]);

  const send = async (mediaUrl?: string, mediaType?: string) => {
    if (!user) return;
    if (!text.trim() && !mediaUrl) return;
    setSending(true);
    const { error } = await supabase.from('dm_messages').insert({
      conversation_id: id, sender_id: user.id,
      content: text.trim() || null, media_url: mediaUrl || null, media_type: mediaType || null,
    });
    if (error) toast.error('Failed to send'); else setText('');
    setSending(false);
  };

  const uploadMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 20 * 1024 * 1024) { toast.error('File must be under 20MB'); return; }
    setSending(true);
    const ext = file.name.split('.').pop();
    const path = `dm/${user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('church-files').upload(path, file, { contentType: file.type });
    if (upErr) { toast.error('Upload failed'); setSending(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('church-files').getPublicUrl(path);
    await send(publicUrl, file.type.startsWith('video/') ? 'video' : 'image');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/50 px-4 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => navigate({ to: '/chat' })} className="neu-btn p-2"><ArrowLeft size={18} /></button>
        <div className="w-10 h-10 rounded-full neu-convex flex items-center justify-center overflow-hidden">
          {other?.avatar_url ? <img src={other.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="font-bold text-primary">{other?.name.charAt(0)}</span>}
        </div>
        <div className="flex-1">
          <p className="text-[15px] font-semibold text-foreground">{other?.name || 'Loading...'}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.map(m => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${mine ? 'bg-primary text-primary-foreground' : 'neu-card-sm'}`}>
                {m.media_url && (m.media_type === 'video' ? (
                  <video src={m.media_url} controls className="rounded-xl max-h-60 mb-1" />
                ) : (
                  <img src={m.media_url} alt="" className="rounded-xl max-h-60 mb-1" />
                ))}
                {m.content && <p className="text-[14px] whitespace-pre-wrap break-words">{m.content}</p>}
                <div className={`flex items-center justify-end gap-1 text-[10px] mt-1 ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  <span>{new Date(m.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                  {mine && (m.is_read ? <CheckCheck size={12} /> : <Check size={12} />)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-background border-t border-border/50 px-4 py-3 flex gap-2" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
        <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={uploadMedia} />
        <button onClick={() => fileRef.current?.click()} className="neu-btn p-3" disabled={sending}><ImageIcon size={18} className="text-primary" /></button>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Message..." className="flex-1 px-4 py-3 neu-input text-foreground text-[14px] focus:outline-none" />
        <button onClick={() => send()} disabled={sending || !text.trim()} className="px-4 py-3 rounded-xl bg-primary text-primary-foreground disabled:opacity-50"><Send size={16} /></button>
      </div>
    </div>
  );
}
