import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { NeuButton } from '@/components/NeuButton';
import { BottomNav } from '@/components/BottomNav';
import { User, Mail, Shield, LogOut } from 'lucide-react';
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
  const { user, profile, role, isLoading, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) navigate({ to: '/auth' });
  }, [user, isLoading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    toast('Signed out');
    navigate({ to: '/auth' });
  };

  if (isLoading) return null;

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="px-5 pt-14">
        <h1 className="text-[22px] font-bold text-foreground mb-8">Profile</h1>

        <div className="flex flex-col items-center mb-8">
          <div className="neu-convex w-20 h-20 rounded-full flex items-center justify-center mb-4">
            <User size={32} className="text-primary" />
          </div>
          <h2 className="text-[18px] font-bold text-foreground">{profile?.name || 'User'}</h2>
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
