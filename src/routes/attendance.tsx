import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BottomNav } from '@/components/BottomNav';
import { CalendarCheck, Check, X, Clock, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/attendance')({
  head: () => ({ meta: [{ title: 'Attendance — NSP Socials' }] }),
  component: AttendancePage,
});

interface Session {
  id: string;
  session_date: string;
  title: string;
  is_open: boolean;
}
interface Record {
  id: string;
  session_id: string;
  user_id: string;
  status: string;
  created_at: string;
  user_name?: string;
}

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function fmtDate(d: string) {
  const dt = new Date(d + 'T00:00:00');
  return { day: DAY_NAMES[dt.getDay()], num: dt.getDate(), month: dt.toLocaleString('en', { month: 'short' }) };
}

function AttendancePage() {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [myRecords, setMyRecords] = useState<Record[]>([]);
  const [pendingRecords, setPendingRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDate, setNewDate] = useState('');
  const [newTitle, setNewTitle] = useState('Service');

  useEffect(() => { if (!isLoading && !user) navigate({ to: '/auth' }); }, [user, isLoading, navigate]);

  const load = useCallback(async () => {
    if (!user) return;
    const { data: ss } = await supabase.from('attendance_sessions').select('*').order('session_date', { ascending: false }).limit(20);
    const { data: rs } = await supabase.from('attendance_records').select('*').eq('user_id', user.id);
    setSessions(ss || []);
    setMyRecords(rs || []);
    if (isAdmin) {
      const { data: pend } = await supabase.from('attendance_records').select('*').eq('status', 'pending').order('created_at', { ascending: false });
      if (pend && pend.length) {
        const ids = [...new Set(pend.map(p => p.user_id))];
        const { data: profs } = await supabase.from('profiles').select('user_id, name').in('user_id', ids);
        const map = new Map((profs || []).map(p => [p.user_id, p.name]));
        setPendingRecords(pend.map(p => ({ ...p, user_name: map.get(p.user_id) || 'User' })));
      } else setPendingRecords([]);
    }
    setLoading(false);
  }, [user, isAdmin]);

  useEffect(() => { load(); }, [load]);

  const checkIn = async (sessionId: string) => {
    if (!user) return;
    const { error } = await supabase.from('attendance_records').insert({ session_id: sessionId, user_id: user.id });
    if (error) { toast.error(error.message); return; }
    toast.success('Check-in submitted! Awaiting admin approval.');
    load();
  };

  const review = async (recordId: string, status: 'approved' | 'rejected') => {
    if (!user) return;
    const { error } = await supabase.from('attendance_records').update({ status, reviewed_at: new Date().toISOString(), reviewed_by: user.id }).eq('id', recordId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Marked ${status}`);
    load();
  };

  const createSession = async () => {
    if (!newDate) return toast.error('Pick a date');
    const { error } = await supabase.from('attendance_sessions').insert({ session_date: newDate, title: newTitle, created_by: user!.id });
    if (error) return toast.error(error.message);
    toast.success('Session created');
    setNewDate(''); setNewTitle('Service');
    load();
  };

  const deleteSession = async (id: string) => {
    if (!confirm('Delete this session?')) return;
    const { error } = await supabase.from('attendance_sessions').delete().eq('id', id);
    if (error) return toast.error(error.message);
    load();
  };

  const myStatusFor = (sid: string) => myRecords.find(r => r.session_id === sid)?.status;

  if (isLoading) return null;

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="px-5 pt-14">
        <div className="flex items-center gap-3 mb-6">
          <div className="neu-convex p-3"><CalendarCheck size={20} className="text-primary" /></div>
          <div>
            <h1 className="text-[22px] font-bold text-foreground">Attendance</h1>
            <p className="text-[12px] text-muted-foreground">Check in & track your presence</p>
          </div>
        </div>

        {isAdmin && (
          <div className="neu-card p-4 mb-6">
            <p className="text-[13px] font-semibold mb-3 text-foreground">➕ Create Session</p>
            <div className="flex gap-2 mb-2">
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                className="flex-1 px-3 py-2 neu-input text-foreground text-[13px] focus:outline-none" />
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Title"
                className="flex-1 px-3 py-2 neu-input text-foreground text-[13px] focus:outline-none" />
            </div>
            <button onClick={createSession} className="neu-btn px-4 py-2 text-primary text-[13px] font-semibold flex items-center gap-2">
              <Plus size={14} /> Add
            </button>
          </div>
        )}

        {isAdmin && pendingRecords.length > 0 && (
          <div className="mb-6">
            <p className="text-[13px] font-semibold mb-3 text-foreground">⏳ Pending Approvals ({pendingRecords.length})</p>
            <div className="space-y-2">
              {pendingRecords.map(r => {
                const s = sessions.find(x => x.id === r.session_id);
                return (
                  <div key={r.id} className="neu-card-sm p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-foreground">{r.user_name}</p>
                      <p className="text-[11px] text-muted-foreground">{s ? `${s.title} • ${s.session_date}` : 'Session'}</p>
                    </div>
                    <button onClick={() => review(r.id, 'approved')} className="neu-btn p-2 text-primary"><Check size={14} /></button>
                    <button onClick={() => review(r.id, 'rejected')} className="neu-btn p-2 text-destructive"><X size={14} /></button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-[13px] font-semibold mb-3 text-foreground">📅 Timeline</p>
        {loading ? (
          <p className="text-center text-muted-foreground text-[13px] py-8">Loading...</p>
        ) : sessions.length === 0 ? (
          <div className="neu-card p-8 text-center">
            <CalendarCheck size={32} className="mx-auto text-muted-foreground mb-2" />
            <p className="text-[13px] text-muted-foreground">No attendance sessions yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map(s => {
              const f = fmtDate(s.session_date);
              const status = myStatusFor(s.id);
              return (
                <div key={s.id} className="neu-card p-4 flex items-center gap-4">
                  <div className="neu-convex p-3 text-center min-w-[60px]">
                    <p className="text-[10px] text-muted-foreground uppercase">{f.day}</p>
                    <p className="text-[20px] font-bold text-primary leading-none">{f.num}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">{f.month}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-foreground">{s.title}</p>
                    {status === 'approved' && <p className="text-[11px] text-primary flex items-center gap-1 mt-1"><Check size={12} /> Approved</p>}
                    {status === 'pending' && <p className="text-[11px] text-church-gold flex items-center gap-1 mt-1"><Clock size={12} /> Pending</p>}
                    {status === 'rejected' && <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><X size={12} /> Rejected</p>}
                  </div>
                  {!status && (
                    <button onClick={() => checkIn(s.id)} className="neu-btn px-4 py-2 text-primary text-[12px] font-semibold">
                      Check in
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={() => deleteSession(s.id)} className="neu-btn p-2 text-destructive"><Trash2 size={14} /></button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
