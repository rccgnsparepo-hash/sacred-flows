import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { NeuButton } from '@/components/NeuButton';
import { BottomNav } from '@/components/BottomNav';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { User, Mail, Shield, LogOut, Camera, Bell, AlertTriangle, MessageCircle, X, Calendar } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/profile')({
  head: () => ({
    meta: [
      { title: 'Profile — Church Hub' },
      { name: 'description', content: 'Your Church Hub profile' },
    ],
  }),
  component: ProfilePage,
});

interface Message {
  id: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

function ProfilePage() {
  const { user, profile, role, isLoading, signOut, isAdmin, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showMessages, setShowMessages] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDob, setEditDob] = useState('');
  const [saving, setSaving] = useState(false);
  const [dob, setDob] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) navigate({ to: '/auth' });
  }, [user, isLoading, navigate]);

  // Fetch DOB from profiles
  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('date_of_birth').eq('user_id', user.id).single().then(({ data }) => {
      if (data?.date_of_birth) setDob(data.date_of_birth);
    });
  }, [user]);

  const fetchMessages = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('messages')
      .select('id, message, type, is_read, created_at')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false });
    if (data) {
      setMessages(data);
      setUnreadCount(data.filter(m => !m.is_read).length);
    }
  }, [user]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const handleSignOut = async () => {
    await signOut();
    toast('Signed out');
    navigate({ to: '/auth' });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2MB'); return; }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: `${publicUrl}?t=${Date.now()}` }).eq('user_id', user.id);
      if (updateError) throw updateError;
      await refreshProfile();
      toast.success('Avatar updated!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const markAsRead = async (msgId: string) => {
    await supabase.from('messages').update({ is_read: true }).eq('id', msgId);
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_read: true } : m));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const startEdit = () => {
    setEditName(profile?.name || '');
    setEditDob(dob || '');
    setEditing(true);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const updates: Record<string, string | null> = {};
    if (editName.trim()) updates.name = editName.trim();
    if (editDob) updates.date_of_birth = editDob;

    const { error } = await supabase.from('profiles').update(updates).eq('user_id', user.id);
    if (error) {
      toast.error('Failed to update profile');
    } else {
      if (editDob) setDob(editDob);
      await refreshProfile();
      toast.success('Profile updated!');
    }
    setSaving(false);
    setEditing(false);
  };

  if (isLoading) return null;

  const initials = profile?.name
    ? profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="px-5 pt-14">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-[22px] font-bold text-foreground">Profile</h1>
          <button onClick={() => setShowMessages(!showMessages)} className="neu-btn p-3 relative">
            <Bell size={18} className="text-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {showMessages ? (
          <div className="mb-6 fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-bold text-foreground">Messages</h2>
              <button onClick={() => setShowMessages(false)} className="neu-btn p-2">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>
            {messages.length === 0 ? (
              <div className="neu-card p-6 text-center">
                <p className="text-muted-foreground text-[14px]">No messages</p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    onClick={() => !msg.is_read && markAsRead(msg.id)}
                    className={`neu-card p-4 ${!msg.is_read ? 'border-l-4 border-primary' : 'opacity-70'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`neu-btn p-2 shrink-0 ${msg.type === 'warning' ? 'text-church-gold' : 'text-primary'}`}>
                        {msg.type === 'warning' ? <AlertTriangle size={16} /> : <MessageCircle size={16} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            msg.type === 'warning' ? 'bg-church-gold/15 text-church-gold' : 'bg-primary/10 text-primary'
                          }`}>
                            {msg.type === 'warning' ? 'Warning' : 'Message'}
                          </span>
                          {!msg.is_read && <span className="w-2 h-2 bg-primary rounded-full" />}
                        </div>
                        <p className="text-[14px] text-foreground">{msg.message}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">{new Date(msg.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center mb-8">
              <div className="relative">
                <Avatar className="w-20 h-20 neu-convex">
                  {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt={profile.name} /> : null}
                  <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">{initials}</AvatarFallback>
                </Avatar>
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="absolute -bottom-1 -right-1 neu-btn p-2 rounded-full">
                  <Camera size={14} className="text-primary" />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              </div>
              <h2 className="text-[18px] font-bold text-foreground mt-4">{profile?.name || 'User'}</h2>
              {uploading && <p className="text-[12px] text-muted-foreground mt-1">Uploading...</p>}
              {isAdmin && (
                <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-church-gold/15 text-church-gold">Admin</span>
              )}
            </div>

            {editing ? (
              <div className="space-y-4 mb-6 fade-in">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-foreground pl-1">Full Name</label>
                  <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-4 py-3.5 neu-input text-foreground text-[15px] focus:outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-foreground pl-1">Date of Birth</label>
                  <input type="date" value={editDob} onChange={e => setEditDob(e.target.value)} className="w-full px-4 py-3.5 neu-input text-foreground text-[15px] focus:outline-none" />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setEditing(false)} className="flex-1 neu-btn py-3 text-[14px] font-semibold text-muted-foreground">Cancel</button>
                  <button onClick={handleSaveProfile} disabled={saving} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-[14px] font-semibold disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="neu-card p-4 flex items-center gap-3">
                  <div className="neu-btn p-2.5"><Mail size={16} className="text-primary" /></div>
                  <div>
                    <p className="text-[12px] text-muted-foreground">Email</p>
                    <p className="text-[14px] text-foreground font-medium">{profile?.email || user?.email}</p>
                  </div>
                </div>

                <div className="neu-card p-4 flex items-center gap-3">
                  <div className="neu-btn p-2.5"><Shield size={16} className="text-primary" /></div>
                  <div>
                    <p className="text-[12px] text-muted-foreground">Role</p>
                    <p className="text-[14px] text-foreground font-medium capitalize">{role || 'user'}</p>
                  </div>
                </div>

                {dob && (
                  <div className="neu-card p-4 flex items-center gap-3">
                    <div className="neu-btn p-2.5"><Calendar size={16} className="text-church-gold" /></div>
                    <div>
                      <p className="text-[12px] text-muted-foreground">Date of Birth</p>
                      <p className="text-[14px] text-foreground font-medium">{new Date(dob).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                  </div>
                )}

                <button onClick={startEdit} className="w-full neu-btn py-3 text-[14px] font-semibold text-primary">
                  Edit Profile
                </button>
              </div>
            )}

            <div className="mt-10">
              <NeuButton variant="destructive" size="lg" onClick={handleSignOut}>
                <LogOut size={18} /> Sign Out
              </NeuButton>
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
