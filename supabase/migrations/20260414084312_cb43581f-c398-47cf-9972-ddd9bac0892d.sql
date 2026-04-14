
CREATE POLICY "Admins can delete profiles"
ON public.profiles FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete user roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete bookmarks"
ON public.bookmarks FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
