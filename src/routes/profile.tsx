import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme, type Theme } from '@/hooks/useTheme';
import { supabase } from '@/integrations/supabase/client';
import { NeuButton } from '@/components/NeuButton';
import { BottomNav } from '@/components/BottomNav';
import { NotificationsSheet } from '@/components/NotificationsSheet';
import { useNotifications } from '@/hooks/useNotifications';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Mail, Shield, LogOut, Camera, Bell, Calendar, Palette, Phone, Settings, Trash2, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/profile')({
  head: () => ({
    meta: [
      { title: 'Profile — NSP App' },
      { name: 'description', content: 'Your NSP App profile' },
    ],
  }),
  component: ProfilePage,
});

const THEMES: { value: Theme; label: string; desc: string }[] = [
  { value: 'light', label: '☀️ Light', desc: 'Clean & bright' },
  { value: 'dark', label: '🌙 Dark', desc: 'Easy on the eyes' },
  { value: 'glass', label: '✨ Glass', desc: 'Frosted glass' },
  { value: 'blur', label: '🌫️ Blur', desc: 'Transparent blur' },
];

function ProfilePage() {
  const { user, profile, isLoading, signOut, isAdmin, refreshProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const { unread } = useNotifications();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState<{ dob: string | null; bio: string | null; phone: string | null; notif: boolean }>({ dob: null, bio: null, phone: null, notif: true });

  useEffect(() => {
    if (!isLoading && !user) navigate({ to: '/auth' });
  }, [user, isLoading, navigate]);

  const loadDetails = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('profiles').select('date_of_birth, bio, phone, notifications_enabled').eq('user_id', user.id).single();
    if (data) setDetails({ dob: data.date_of_birth, bio: data.bio, phone: data.phone, notif: data.notifications_enabled ?? true });
  }, [user]);

  useEffect(() => { loadDetails(); }, [loadDetails]);

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
      await supabase.from('profiles').update({ avatar_url: `${publicUrl}?t=${Date.now()}` }).eq('user_id', user.id);
      await refreshProfile();
      toast.success('Avatar updated!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const startEdit = () => {
    setEditName(profile?.name || '');
    setEditDob(details.dob || '');
    setEditBio(details.bio || '');
    setEditPhone(details.phone || '');
    setEditing(true);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      name: editName.trim() || undefined,
      date_of_birth: editDob || null,
      bio: editBio.trim() || null,
      phone: editPhone.trim() || null,
    }).eq('user_id', user.id);
    if (error) {
      toast.error('Failed to update profile');
    } else {
      await refreshProfile();
      await loadDetails();
      toast.success('Profile updated!');
    }
    setSaving(false);
    setEditing(false);
  };

  const toggleNotifs = async (enabled: boolean) => {
    if (!user) return;
    setDetails(d => ({ ...d, notif: enabled }));
    await supabase.from('profiles').update({ notifications_enabled: enabled }).eq('user_id', user.id);
    toast.success(enabled ? 'Notifications enabled' : 'Notifications disabled');
  };

  const handleChangeEmail = async () => {
    const newEmail = prompt('Enter new email address:');
    if (!newEmail || !newEmail.trim()) return;
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    if (error) toast.error(error.message);
    else toast.success('Verification email sent to new address');
  };

  const handleChangePassword = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) toast.error(error.message);
    else toast.success('Password reset email sent');
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (!confirm('Are you absolutely sure? This will delete all your data permanently.')) return;
    if (!confirm('This cannot be undone. Continue?')) return;
    // Delete profile data; auth user removal requires admin API
    await Promise.all([
      supabase.from('profiles').delete().eq('user_id', user.id),
      supabase.from('user_roles').delete().eq('user_id', user.id),
      supabase.from('posts').delete().eq('user_id', user.id),
    ]);
    await signOut();
    toast.success('Account data deleted');
    navigate({ to: '/auth' });
  };

  if (isLoading) return null;

  const initials = profile?.name
    ? profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email?.charAt(0).toUpperCase() || 'U');

  const displayName = profile?.name?.trim() || user?.email?.split('@')[0] || 'User';

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="px-5 pt-14">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[22px] font-bold text-foreground">Profile</h1>
          <div className="flex gap-2">
            <button onClick={() => { setShowSettings(false); setShowThemes(!showThemes); }} className="neu-btn p-3" aria-label="Themes">
              <Palette size={18} className="text-primary" />
            </button>
            <button onClick={() => { setShowThemes(false); setShowSettings(!showSettings); }} className="neu-btn p-3" aria-label="Settings">
              <Settings size={18} className="text-foreground" />
            </button>
            <button onClick={() => setShowNotifs(true)} className="neu-btn p-3 relative" aria-label="Notifications">
              <Bell size={18} className="text-foreground" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Theme picker */}
        {showThemes && (
          <div className="mb-6 fade-in">
            <h2 className="text-[15px] font-bold text-foreground mb-3">Choose Theme</h2>
            <div className="grid grid-cols-2 gap-3">
              {THEMES.map(t => (
                <button
                  key={t.value}
                  onClick={() => { setTheme(t.value); toast.success(`${t.label} theme applied`); }}
                  className={`p-4 rounded-2xl text-left transition-all ${
                    theme === t.value ? 'neu-pressed border-2 border-primary' : 'neu-card'
                  }`}
                >
                  <p className="text-[14px] font-semibold text-foreground">{t.label}</p>
                  <p className="text-[12px] text-muted-foreground">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Settings panel */}
        {showSettings && (
          <div className="mb-6 fade-in space-y-3">
            <h2 className="text-[15px] font-bold text-foreground mb-3">Settings</h2>

            <div className="neu-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="neu-btn p-2.5"><Bell size={16} className="text-primary" /></div>
                <div>
                  <p className="text-[14px] font-semibold text-foreground">Notifications</p>
                  <p className="text-[11px] text-muted-foreground">Likes, comments, follows</p>
                </div>
              </div>
              <Switch checked={details.notif} onCheckedChange={toggleNotifs} />
            </div>

            <button onClick={handleChangeEmail} className="w-full neu-card p-4 flex items-center gap-3">
              <div className="neu-btn p-2.5"><Mail size={16} className="text-primary" /></div>
              <div className="flex-1 text-left">
                <p className="text-[14px] font-semibold text-foreground">Change Email</p>
                <p className="text-[11px] text-muted-foreground">{user?.email}</p>
              </div>
            </button>

            <button onClick={handleChangePassword} className="w-full neu-card p-4 flex items-center gap-3">
              <div className="neu-btn p-2.5"><KeyRound size={16} className="text-church-gold" /></div>
              <div className="flex-1 text-left">
                <p className="text-[14px] font-semibold text-foreground">Reset Password</p>
                <p className="text-[11px] text-muted-foreground">Send reset email</p>
              </div>
            </button>

            <button onClick={handleDeleteAccount} className="w-full neu-card p-4 flex items-center gap-3 border border-destructive/30">
              <div className="neu-btn p-2.5"><Trash2 size={16} className="text-destructive" /></div>
              <div className="flex-1 text-left">
                <p className="text-[14px] font-semibold text-destructive">Delete Account</p>
                <p className="text-[11px] text-muted-foreground">Permanently remove your data</p>
              </div>
            </button>
          </div>
        )}

        {!showSettings && !showThemes && (
          <>
            <div className="flex flex-col items-center mb-8">
              <div className="relative">
                <Avatar className="w-20 h-20 neu-convex">
                  {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt={displayName} /> : null}
                  <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">{initials}</AvatarFallback>
                </Avatar>
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="absolute -bottom-1 -right-1 neu-btn p-2 rounded-full">
                  <Camera size={14} className="text-primary" />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              </div>
              <h2 className="text-[18px] font-bold text-foreground mt-4">{displayName}</h2>
              {details.bio && <p className="text-[13px] text-muted-foreground mt-1 text-center max-w-[250px]">{details.bio}</p>}
              {uploading && <p className="text-[12px] text-muted-foreground mt-1">Uploading...</p>}
              {isAdmin && (
                <span className="mt-2 text-[11px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-church-gold/15 text-church-gold">Admin</span>
              )}
            </div>

            {isAdmin && (
              <button
                onClick={() => navigate({ to: '/admin' })}
                className="w-full neu-card p-4 flex items-center gap-3 mb-4"
              >
                <div className="neu-btn p-2.5"><Shield size={16} className="text-church-gold" /></div>
                <div className="flex-1 text-left">
                  <p className="text-[14px] font-semibold text-foreground">Admin Dashboard</p>
                  <p className="text-[12px] text-muted-foreground">Manage content & users</p>
                </div>
              </button>
            )}

            {editing ? (
              <div className="space-y-4 mb-6 fade-in">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-foreground pl-1">Full Name</label>
                  <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-4 py-3.5 neu-input text-foreground text-[15px] focus:outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-foreground pl-1">Phone</label>
                  <input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} className="w-full px-4 py-3.5 neu-input text-foreground text-[15px] focus:outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-foreground pl-1">Bio</label>
                  <textarea value={editBio} onChange={e => setEditBio(e.target.value)} placeholder="Tell us about yourself..." rows={2} maxLength={200} className="w-full px-4 py-3 neu-input text-foreground text-[14px] placeholder:text-muted-foreground focus:outline-none resize-none" />
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
                {details.phone && (
                  <div className="neu-card p-4 flex items-center gap-3">
                    <div className="neu-btn p-2.5"><Phone size={16} className="text-primary" /></div>
                    <div>
                      <p className="text-[12px] text-muted-foreground">Phone</p>
                      <p className="text-[14px] text-foreground font-medium">{details.phone}</p>
                    </div>
                  </div>
                )}
                {details.dob && (
                  <div className="neu-card p-4 flex items-center gap-3">
                    <div className="neu-btn p-2.5"><Calendar size={16} className="text-church-gold" /></div>
                    <div>
                      <p className="text-[12px] text-muted-foreground">Date of Birth</p>
                      <p className="text-[14px] text-foreground font-medium">{new Date(details.dob).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</p>
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

      {showNotifs && <NotificationsSheet onClose={() => setShowNotifs(false)} />}
      <BottomNav />
    </div>
  );
}
