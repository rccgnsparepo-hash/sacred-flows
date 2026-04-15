
-- Add date_of_birth to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Create prayer_requests table
CREATE TABLE public.prayer_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  pray_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.prayer_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view prayer requests"
  ON public.prayer_requests FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can create their own prayer requests"
  ON public.prayer_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own prayer requests"
  ON public.prayer_requests FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any prayer request"
  ON public.prayer_requests FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update pray count"
  ON public.prayer_requests FOR UPDATE TO authenticated
  USING (true);

-- Create gallery table
CREATE TABLE public.gallery (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT NOT NULL,
  caption TEXT,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.gallery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view gallery"
  ON public.gallery FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert gallery items"
  ON public.gallery FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update gallery items"
  ON public.gallery FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete gallery items"
  ON public.gallery FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.prayer_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gallery;
ALTER PUBLICATION supabase_realtime ADD TABLE public.content;
