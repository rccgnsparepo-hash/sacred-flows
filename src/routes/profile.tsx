import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { NeuButton } from '@/components/NeuButton';
import { BottomNav } from '@/components/BottomNav';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { User, Mail, Shield, LogOut, Camera } from 'lucide-react';
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

function ProfilePage() {
  const { user, profile, role, isLoading, signOut, isAdmin, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) navigate({ to: '/auth' });
  }, [user, isLoading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    toast('Signed out');
    navigate({ to: '/auth' });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: `${publicUrl}?t=${Date.now()}` })
        .eq('user_id', user.id);
      if (updateError) throw updateError;

      await refreshProfile();
      toast.success('Avatar updated!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) return null;

  const initials = profile?.name
    ? profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="px-5 pt-14">
        <h1 className="text-[22px] font-bold text-foreground mb-8">Profile</h1>

        <div className="flex flex-col items-center mb-8">
          <div className="relative">
            <Avatar className="w-20 h-20 neu-convex">
              {profile?.avatar_url ? (
                <AvatarImage src={profile.avatar_url} alt={profile.name} />
              ) : null}
              <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 neu-btn p-2 rounded-full"
            >
              <Camera size={14} className="text-primary" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
          <h2 className="text-[18px] font-bold text-foreground mt-4">{profile?.name || 'User'}</h2>
          {uploading && <p className="text-[12px] text-muted-foreground mt-1">Uploading...</p>}
          {isAdmin && (
            <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-church-gold/15 text-church-gold">
              Admin
            </span>
          )}
        </div>

        <div className="space-y-4">
          <div className="neu-card p-4 flex items-center gap-3">
            <div className="neu-btn p-2.5">
              <Mail size={16} className="text-primary" />
            </div>
            <div>
              <p className="text-[12px] text-muted-foreground">Email</p>
              <p className="text-[14px] text-foreground font-medium">{profile?.email || user?.email}</p>
            </div>
          </div>

          <div className="neu-card p-4 flex items-center gap-3">
            <div className="neu-btn p-2.5">
              <Shield size={16} className="text-primary" />
            </div>
            <div>
              <p className="text-[12px] text-muted-foreground">Role</p>
              <p className="text-[14px] text-foreground font-medium capitalize">{role || 'user'}</p>
            </div>
          </div>
        </div>

        <div className="mt-10">
          <NeuButton variant="destructive" size="lg" onClick={handleSignOut}>
            <LogOut size={18} /> Sign Out
          </NeuButton>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
