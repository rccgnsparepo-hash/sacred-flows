
-- Drop the overly permissive update policy
DROP POLICY IF EXISTS "Users can update pray count" ON public.prayer_requests;

-- Create a function to safely increment pray count
CREATE OR REPLACE FUNCTION public.increment_pray_count(request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.prayer_requests
  SET pray_count = pray_count + 1
  WHERE id = request_id;
END;
$$;
