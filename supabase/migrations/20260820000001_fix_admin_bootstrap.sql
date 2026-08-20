-- The privilege-escalation trigger from 20260820000000 required an existing
-- admin to approve any role/approval_status change, which meant nobody could
-- ever create the first admin. Allow the change through when no admin exists
-- yet; once one does, this bootstrap path closes permanently.

CREATE OR REPLACE FUNCTION public.prevent_self_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    IF EXISTS (SELECT 1 FROM public.users WHERE role = 'admin')
       AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
      RAISE EXCEPTION 'Only admins can change role or approval_status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
