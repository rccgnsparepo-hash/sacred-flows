import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { BottomNav } from '@/components/BottomNav';
import { Upload, Users, FileText, Image, ArrowRight, HandHeart } from 'lucide-react';

export const Route = createFileRoute('/admin')({
  head: () => ({
    meta: [
      { title: 'Admin — NSP App' },
      { name: 'description', content: 'Admin dashboard for managing content' },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) navigate({ to: '/home' });
  }, [user, isAdmin, isLoading, navigate]);

  if (isLoading || !isAdmin) return null;

  const cards = [
    { to: '/admin/upload' as const, icon: Upload, color: 'text-primary', title: 'Upload Content', desc: 'Add PDFs or YouTube links' },
    { to: '/admin/content' as const, icon: FileText, color: 'text-church-gold', title: 'Manage Content', desc: 'Edit or delete content' },
    { to: '/admin/gallery' as const, icon: Image, color: 'text-church-gold', title: 'Gallery', desc: 'Upload & manage photos' },
    { to: '/admin/users' as const, icon: Users, color: 'text-primary', title: 'Users', desc: 'Manage users & send messages' },
  ];

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="px-5 pt-14">
        <h1 className="text-[22px] font-bold text-foreground mb-2">Admin Panel</h1>
        <p className="text-[13px] text-muted-foreground mb-8">Manage content & users</p>

        <div className="space-y-4">
          {cards.map(({ to, icon: Icon, color, title, desc }) => (
            <Link key={to} to={to} className="block">
              <div className="neu-card p-5 flex items-center gap-4">
                <div className="neu-convex p-3">
                  <Icon size={20} className={color} />
                </div>
                <div className="flex-1">
                  <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
                  <p className="text-[13px] text-muted-foreground">{desc}</p>
                </div>
                <ArrowRight size={18} className="text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
