
DROP POLICY IF EXISTS "System inserts notifications" ON public.notifications;
CREATE POLICY "Users insert notifications they trigger" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = actor_id);
