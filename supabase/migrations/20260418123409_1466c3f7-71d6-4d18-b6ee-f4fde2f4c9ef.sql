
-- Attendance sessions (admin-created date slots)
CREATE TABLE public.attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_date DATE NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT 'Service',
  is_open BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authed view sessions" ON public.attendance_sessions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert sessions" ON public.attendance_sessions
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update sessions" ON public.attendance_sessions
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete sessions" ON public.attendance_sessions
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Attendance records (user check-ins)
CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  UNIQUE(session_id, user_id)
);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own records" ON public.attendance_records
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users create own records" ON public.attendance_records
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins update records" ON public.attendance_records
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete records" ON public.attendance_records
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Notify on approval
CREATE OR REPLACE FUNCTION public.notify_attendance_review()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status <> OLD.status AND NEW.status IN ('approved','rejected') THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, message)
    VALUES (NEW.user_id, NEW.reviewed_by, 'admin',
      CASE WHEN NEW.status = 'approved' THEN '✅ Your attendance was approved'
           ELSE '❌ Your attendance was not approved' END);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_attendance_review
  AFTER UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.notify_attendance_review();
