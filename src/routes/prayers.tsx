import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BottomNav } from '@/components/BottomNav';
import { SkeletonCard } from '@/components/SkeletonCard';
import { NeuButton } from '@/components/NeuButton';
import { HandHeart, Plus, Send, X, Heart } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/prayers')({
  head: () => ({
    meta: [
      { title: 'Prayer Requests — Church Hub' },
      { name: 'description', content: 'Share and support prayer requests' },
    ],
  }),
  component: PrayersPage,
});

interface PrayerRequest {
  id: string;
  user_id: string;
  message: string;
  pray_count: number;
  created_at: string;
  user_name?: string;
  user_avatar?: string;
}

function PrayersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<PrayerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [prayedIds, setPrayedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: '/auth' });
  }, [user, authLoading, navigate]);

  const fetchRequests = useCallback(async () => {
    const { data } = await supabase
      .from('prayer_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      // Fetch user profiles for each request
      const userIds = [...new Set(data.map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      setRequests(data.map(r => ({
        ...r,
        user_name: profileMap.get(r.user_id)?.name || 'Anonymous',
        user_avatar: profileMap.get(r.user_id)?.avatar_url || undefined,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('prayer-requests-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prayer_requests' }, () => {
        fetchRequests();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchRequests]);

  const handleSubmit = async () => {
    if (!message.trim() || !user) return;
    setSubmitting(true);
    const { error } = await supabase.from('prayer_requests').insert({
      user_id: user.id,
      message: message.trim(),
    });
    if (error) {
      toast.error('Failed to submit prayer request');
    } else {
      toast.success('Prayer request submitted 🙏');
      setMessage('');
      setShowForm(false);
    }
    setSubmitting(false);
  };

  const handlePray = async (requestId: string) => {
    if (prayedIds.has(requestId)) return;
    setPrayedIds(prev => new Set(prev).add(requestId));
    setRequests(prev => prev.map(r => r.id === requestId ? { ...r, pray_count: r.pray_count + 1 } : r));

    const { error } = await supabase.rpc('increment_pray_count', { request_id: requestId });
    if (error) {
      setPrayedIds(prev => { const s = new Set(prev); s.delete(requestId); return s; });
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, pray_count: r.pray_count - 1 } : r));
    }
  };

  const handleDelete = async (requestId: string) => {
    const { error } = await supabase.from('prayer_requests').delete().eq('id', requestId);
    if (!error) {
      setRequests(prev => prev.filter(r => r.id !== requestId));
      toast('Prayer request removed');
    }
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="px-5 pt-14 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="neu-convex p-3">
              <HandHeart size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="text-[22px] font-bold text-foreground">Prayer Requests</h1>
              <p className="text-[13px] text-muted-foreground">Lift each other up in prayer</p>
            </div>
          </div>
          <button onClick={() => setShowForm(true)} className="neu-btn p-3">
            <Plus size={18} className="text-primary" />
          </button>
        </div>
      </div>

      {/* New prayer request form */}
      {showForm && (
        <div className="px-5 mb-4 fade-in">
          <div className="neu-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-semibold text-foreground">New Prayer Request</h3>
              <button onClick={() => setShowForm(false)} className="neu-btn p-2">
                <X size={14} className="text-muted-foreground" />
              </button>
            </div>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Share your prayer request..."
              rows={3}
              maxLength={500}
              className="w-full px-4 py-3 neu-input text-foreground text-[14px] placeholder:text-muted-foreground focus:outline-none resize-none mb-3"
            />
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground">{message.length}/500</span>
              <button
                onClick={handleSubmit}
                disabled={!message.trim() || submitting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-[14px] font-semibold disabled:opacity-50"
              >
                <Send size={14} />
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="px-5 space-y-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : requests.length === 0 ? (
          <div className="text-center py-16">
            <HandHeart size={40} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-[15px]">No prayer requests yet</p>
            <p className="text-muted-foreground text-[13px] mt-1">Be the first to share</p>
          </div>
        ) : (
          requests.map(req => (
            <div key={req.id} className="neu-card p-5 slide-up">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-full neu-convex flex items-center justify-center shrink-0 overflow-hidden">
                  {req.user_avatar ? (
                    <img src={req.user_avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[12px] font-bold text-primary">
                      {req.user_name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">{req.user_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(req.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {req.user_id === user?.id && (
                  <button onClick={() => handleDelete(req.id)} className="text-[12px] text-muted-foreground">
                    <X size={14} />
                  </button>
                )}
              </div>
              <p className="text-[14px] text-foreground leading-relaxed mb-3">{req.message}</p>
              <button
                onClick={() => handlePray(req.id)}
                disabled={prayedIds.has(req.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all ${
                  prayedIds.has(req.id)
                    ? 'neu-pressed text-primary'
                    : 'neu-btn text-muted-foreground'
                }`}
              >
                <Heart size={14} className={prayedIds.has(req.id) ? 'fill-primary' : ''} />
                Praying · {req.pray_count}
              </button>
            </div>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}
