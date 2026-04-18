import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { BottomNav } from '@/components/BottomNav';
import { HandHeart, Shield, Bookmark, MessageCircle, Image as ImageIcon, FileText, ArrowRight, CalendarCheck } from 'lucide-react';

export const Route = createFileRoute('/more')({
  head: () => ({ meta: [{ title: 'More — NSP Socials' }] }),
  component: MorePage,
});

function MorePage() {
  const { user, isLoading, isAdmin } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!isLoading && !user) navigate({ to: '/auth' }); }, [user, isLoading, navigate]);

  const items = [
    { to: '/feed/admin' as const, icon: Shield, label: 'Admin Posts', desc: 'Posts from admins', color: 'text-church-gold' },
    { to: '/attendance' as const, icon: CalendarCheck, label: 'Attendance', desc: 'Check in to services', color: 'text-primary' },
    { to: '/prayers' as const, icon: HandHeart, label: 'Community Prayer', desc: 'Share & support', color: 'text-primary' },
    { to: '/gallery' as const, icon: ImageIcon, label: 'Gallery', desc: 'Browse photos', color: 'text-primary' },
    { to: '/library' as const, icon: FileText, label: 'Resources', desc: 'PDFs & links', color: 'text-foreground' },
    { to: '/saved' as const, icon: Bookmark, label: 'Saved Posts', desc: 'Your bookmarks', color: 'text-primary' },
    { to: '/chat' as const, icon: MessageCircle, label: 'Messages', desc: 'Chat with users', color: 'text-primary' },
  ];

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="px-5 pt-14">
        <h1 className="text-[22px] font-bold text-foreground mb-2">More</h1>
        <p className="text-[13px] text-muted-foreground mb-6">Explore the community</p>

        <div className="space-y-3">
          {items.map(({ to, icon: Icon, label, desc, color }) => (
            <Link key={to} to={to} className="block">
              <div className="neu-card p-4 flex items-center gap-3">
                <div className="neu-btn p-3"><Icon size={18} className={color} /></div>
                <div className="flex-1">
                  <p className="text-[14px] font-semibold text-foreground">{label}</p>
                  <p className="text-[12px] text-muted-foreground">{desc}</p>
                </div>
                <ArrowRight size={16} className="text-muted-foreground" />
              </div>
            </Link>
          ))}

          {isAdmin && (
            <Link to="/admin" className="block">
              <div className="neu-card p-4 flex items-center gap-3 border-2 border-church-gold/30">
                <div className="neu-btn p-3"><Shield size={18} className="text-church-gold" /></div>
                <div className="flex-1">
                  <p className="text-[14px] font-semibold text-foreground">Admin Dashboard</p>
                  <p className="text-[12px] text-muted-foreground">Manage everything</p>
                </div>
                <ArrowRight size={16} className="text-muted-foreground" />
              </div>
            </Link>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
