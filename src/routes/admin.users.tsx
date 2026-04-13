import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SkeletonCard } from '@/components/SkeletonCard';
import { ArrowLeft, User, Shield } from 'lucide-react';

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
              <div key={u.id} className="neu-card p-4 flex items-center gap-3">
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
            ))
          )}
        </div>
      </div>
    </div>
  );
}
