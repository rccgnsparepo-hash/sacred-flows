import { createFileRoute, useNavigate, Link, Outlet } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { BottomNav } from '@/components/BottomNav';
import { Upload, Users, FileText, ArrowRight } from 'lucide-react';

export const Route = createFileRoute('/admin')({
  head: () => ({
    meta: [
      { title: 'Admin — Church Hub' },
      { name: 'description', content: 'Admin dashboard for managing church content' },
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

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="px-5 pt-14">
        <h1 className="text-[22px] font-bold text-foreground mb-2">Admin Panel</h1>
        <p className="text-[13px] text-muted-foreground mb-8">Manage content & users</p>

        <div className="space-y-4">
          <Link to="/admin/upload" className="block">
            <div className="neu-card p-5 flex items-center gap-4">
              <div className="neu-convex p-3">
                <Upload size={20} className="text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-[15px] font-semibold text-foreground">Upload Content</h3>
                <p className="text-[13px] text-muted-foreground">Add PDFs or YouTube links</p>
              </div>
              <ArrowRight size={18} className="text-muted-foreground" />
            </div>
          </Link>

          <Link to="/admin/content" className="block">
            <div className="neu-card p-5 flex items-center gap-4">
              <div className="neu-convex p-3">
                <FileText size={20} className="text-church-gold" />
              </div>
              <div className="flex-1">
                <h3 className="text-[15px] font-semibold text-foreground">Manage Content</h3>
                <p className="text-[13px] text-muted-foreground">Edit or delete existing content</p>
              </div>
              <ArrowRight size={18} className="text-muted-foreground" />
            </div>
          </Link>

          <Link to="/admin/users" className="block">
            <div className="neu-card p-5 flex items-center gap-4">
              <div className="neu-convex p-3">
                <Users size={20} className="text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-[15px] font-semibold text-foreground">View Users</h3>
                <p className="text-[13px] text-muted-foreground">See registered users</p>
              </div>
              <ArrowRight size={18} className="text-muted-foreground" />
            </div>
          </Link>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
