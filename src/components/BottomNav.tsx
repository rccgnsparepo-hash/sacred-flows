import { Link, useLocation } from '@tanstack/react-router';
import { Home, BookOpen, User, Shield } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export function BottomNav() {
  const location = useLocation();
  const { isAdmin } = useAuth();
  const path = location.pathname;

  const tabs = [
    { to: '/home' as const, icon: Home, label: 'Home' },
    { to: '/library' as const, icon: BookOpen, label: 'Library' },
    { to: '/profile' as const, icon: User, label: 'Profile' },
    ...(isAdmin ? [{ to: '/admin' as const, icon: Shield, label: 'Admin' }] : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-2">
      <div className="mx-auto max-w-md neu-card p-2 flex justify-around items-center">
        {tabs.map(({ to, icon: Icon, label }) => {
          const isActive = path.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 ${
                isActive ? 'neu-pressed text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
