import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { X, Send, CornerDownRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Comment {
  id: string;
  user_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  user_name?: string;
  user_avatar?: string;
  replies?: Comment[];
}

interface CommentsSheetProps {
  postId: string;
  onClose: () => void;
}

export function CommentsSheet({ postId, onClose }: CommentsSheetProps) {
  const { user, isAdmin } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchComments = useCallback(async () => {
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (data) {
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const enriched = data.map(c => ({
        ...c,
        user_name: profileMap.get(c.user_id)?.name || 'User',
        user_avatar: profileMap.get(c.user_id)?.avatar_url || undefined,
      }));

      // Nest replies
      const topLevel: Comment[] = [];
      const replyMap = new Map<string, Comment[]>();
      enriched.forEach(c => {
        if (c.parent_id) {
          const arr = replyMap.get(c.parent_id) || [];
          arr.push(c);
          replyMap.set(c.parent_id, arr);
        } else {
          topLevel.push(c);
        }
      });
      topLevel.forEach(c => { c.replies = replyMap.get(c.id) || []; });
      setComments(topLevel);
    }
    setLoading(false);
  }, [postId]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`comments-${postId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` }, () => {
        fetchComments();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [postId, fetchComments]);

  const handleSend = async () => {
    if (!text.trim() || !user) return;
    setSending(true);
    const { error } = await supabase.from('comments').insert({
      user_id: user.id,
      post_id: postId,
      content: text.trim(),
      parent_id: replyTo?.id || null,
    });
    if (error) toast.error('Failed to post comment');
    setText('');
    setReplyTo(null);
    setSending(false);
  };

  const handleDelete = async (commentId: string) => {
    await supabase.from('comments').delete().eq('id', commentId);
  };

  const renderComment = (c: Comment, isReply = false) => (
    <div key={c.id} className={`flex gap-2.5 ${isReply ? 'ml-10' : ''}`}>
      <div className="w-8 h-8 rounded-full neu-convex flex items-center justify-center shrink-0 overflow-hidden">
        {c.user_avatar ? (
          <img src={c.user_avatar} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-[10px] font-bold text-primary">{c.user_name?.charAt(0).toUpperCase()}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="neu-card-sm p-3">
          <p className="text-[12px] font-semibold text-foreground">{c.user_name}</p>
          <p className="text-[13px] text-foreground mt-0.5">{c.content}</p>
        </div>
        <div className="flex items-center gap-3 mt-1 px-1">
          <span className="text-[10px] text-muted-foreground">
            {new Date(c.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          </span>
          {!isReply && (
            <button
              onClick={() => setReplyTo({ id: c.id, name: c.user_name || 'User' })}
              className="text-[11px] font-medium text-primary"
            >
              Reply
            </button>
          )}
          {(c.user_id === user?.id || isAdmin) && (
            <button onClick={() => handleDelete(c.id)} className="text-[11px] text-muted-foreground">
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-end bg-foreground/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-h-[85vh] bg-background rounded-t-3xl flex flex-col slide-up shadow-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <h3 className="text-[16px] font-bold text-foreground">Comments</h3>
          <button onClick={onClose} className="p-2 text-muted-foreground"><X size={18} /></button>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <p className="text-center text-muted-foreground text-[13px] py-8">Loading...</p>
          ) : comments.length === 0 ? (
            <p className="text-center text-muted-foreground text-[13px] py-8">No comments yet. Be the first!</p>
          ) : (
            comments.map(c => (
              <div key={c.id}>
                {renderComment(c)}
                {c.replies?.map(r => renderComment(r, true))}
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border/50">
          {replyTo && (
            <div className="flex items-center gap-2 mb-2">
              <CornerDownRight size={12} className="text-muted-foreground" />
              <span className="text-[12px] text-muted-foreground">Replying to {replyTo.name}</span>
              <button onClick={() => setReplyTo(null)} className="text-[12px] text-primary">Cancel</button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 px-4 py-3 neu-input text-foreground text-[14px] placeholder:text-muted-foreground focus:outline-none"
              onKeyDown={e => e.key === 'Enter' && handleSend()}
            />
            <button
              onClick={handleSend}
              disabled={!text.trim() || sending}
              className="px-4 py-3 rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
