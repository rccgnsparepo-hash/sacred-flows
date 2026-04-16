import { Link, useLocation } from '@tanstack/react-router';
import { Home, Play, HandHeart, PlusCircle, User, Shield } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export function BottomNav() {
  const location = useLocation();
  const { isAdmin } = useAuth();
  const path = location.pathname;

  const tabs = [
    { to: '/home' as const, icon: Home, label: 'Home' },
    { to: '/videos' as const, icon: Play, label: 'Videos' },
    { to: '/create' as const, icon: PlusCircle, label: 'Create', special: true },
    { to: '/prayers' as const, icon: HandHeart, label: 'Prayer' },
    { to: '/profile' as const, icon: User, label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-2">
      <div className="mx-auto max-w-md neu-card p-2 flex justify-around items-center">
        {tabs.map(({ to, icon: Icon, label, special }) => {
          const isActive = path.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 ${
                special
                  ? 'text-primary'
                  : isActive ? 'neu-pressed text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon size={special ? 24 : 20} strokeWidth={isActive || special ? 2.5 : 1.8} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
