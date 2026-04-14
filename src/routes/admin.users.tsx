import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SkeletonCard } from '@/components/SkeletonCard';
import { NeuButton } from '@/components/NeuButton';
import { ArrowLeft, User, Shield, Trash2, AlertTriangle, MessageCircle, Send } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/admin/users')({
  head: () => ({
    meta: [{ title: 'Users — Church Hub' }],
  }),
  component: UsersPage,
});

interface UserProfile {
  id: string;
  name: string;
  email: string;
  created_at: string;
  user_id: string;
}

function UsersPage() {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [messageModal, setMessageModal] = useState<{ userId: string; name: string; type: 'message' | 'warning' } | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) navigate({ to: '/home' });
  }, [user, isAdmin, isLoading, navigate]);

  const fetchUsers = useCallback(async () => {
    const [profileRes, roleRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('user_roles').select('user_id, role').eq('role', 'admin'),
    ]);
    if (profileRes.data) setUsers(profileRes.data);
    if (roleRes.data) setAdminIds(new Set(roleRes.data.map(r => r.user_id)));
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleDelete = async (targetUserId: string, name: string) => {
    if (targetUserId === user?.id) { toast.error("You can't delete yourself"); return; }
    if (!confirm(`Are you sure you want to delete ${name || 'this user'}? This cannot be undone.`)) return;

    // Delete profile, bookmarks, and role (cascade via RLS)
    const { error: profileError } = await supabase.from('profiles').delete().eq('user_id', targetUserId);
    if (profileError) {
      toast.error('Failed to delete user');
      return;
    }
    await supabase.from('user_roles').delete().eq('user_id', targetUserId);
    await supabase.from('bookmarks').delete().eq('user_id', targetUserId);
    setUsers(prev => prev.filter(u => u.user_id !== targetUserId));
    toast.success(`${name || 'User'} deleted`);
  };

  const handleSendMessage = async () => {
    if (!messageModal || !messageText.trim() || !user) return;
    setSending(true);
    const { error } = await supabase.from('messages').insert({
      sender_id: user.id,
      recipient_id: messageModal.userId,
      message: messageText.trim(),
      type: messageModal.type,
    });
    if (error) {
      toast.error('Failed to send');
    } else {
      toast.success(messageModal.type === 'warning' ? 'Warning sent' : 'Message sent');
    }
    setSending(false);
    setMessageModal(null);
    setMessageText('');
  };

  if (isLoading || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="px-5 pt-14">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate({ to: '/admin' })} className="neu-btn p-3">
            <ArrowLeft size={18} className="text-foreground" />
          </button>
          <h1 className="text-[20px] font-bold text-foreground">Users ({users.length})</h1>
        </div>

        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          ) : (
            users.map(u => (
              <div key={u.id} className="neu-card p-4">
                <div className="flex items-center gap-3">
                  <div className="neu-btn p-2.5">
                    <User size={16} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-semibold text-foreground line-clamp-1">{u.name || 'Unnamed'}</p>
                      {adminIds.has(u.user_id) && (
                        <Shield size={12} className="text-church-gold shrink-0" />
                      )}
                    </div>
                    <p className="text-[12px] text-muted-foreground line-clamp-1">{u.email}</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground shrink-0">
                    {new Date(u.created_at).toLocaleDateString()}
                  </p>
                </div>

                {/* Action buttons */}
                {u.user_id !== user?.id && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                    <button
                      onClick={() => setMessageModal({ userId: u.user_id, name: u.name, type: 'message' })}
                      className="neu-btn p-2 flex items-center gap-1.5 text-[12px] font-medium text-primary"
                    >
                      <MessageCircle size={14} /> Message
                    </button>
                    <button
                      onClick={() => setMessageModal({ userId: u.user_id, name: u.name, type: 'warning' })}
                      className="neu-btn p-2 flex items-center gap-1.5 text-[12px] font-medium text-church-gold"
                    >
                      <AlertTriangle size={14} /> Warn
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={() => handleDelete(u.user_id, u.name)}
                      className="neu-btn p-2 flex items-center gap-1.5 text-[12px] font-medium text-destructive"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Message/Warning Modal */}
      {messageModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 backdrop-blur-sm" onClick={() => setMessageModal(null)}>
          <div
            className="w-full max-w-lg bg-background rounded-t-3xl p-6 slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-4">
              {messageModal.type === 'warning' ? (
                <AlertTriangle size={20} className="text-church-gold" />
              ) : (
                <MessageCircle size={20} className="text-primary" />
              )}
              <h3 className="text-[16px] font-bold text-foreground">
                {messageModal.type === 'warning' ? 'Send Warning' : 'Send Message'} to {messageModal.name || 'User'}
              </h3>
            </div>
            <textarea
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              placeholder={messageModal.type === 'warning' ? 'Enter warning message...' : 'Type your message...'}
              rows={4}
              className="w-full px-4 py-3.5 neu-input text-foreground text-[15px] placeholder:text-muted-foreground focus:outline-none resize-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setMessageModal(null)} className="flex-1 neu-btn py-3 text-[14px] font-semibold text-muted-foreground">
                Cancel
              </button>
              <button
                onClick={handleSendMessage}
                disabled={!messageText.trim() || sending}
                className={`flex-1 py-3 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 ${
                  messageModal.type === 'warning'
                    ? 'bg-church-gold text-church-gold-foreground'
                    : 'bg-primary text-primary-foreground'
                } disabled:opacity-50`}
              >
                <Send size={16} />
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
