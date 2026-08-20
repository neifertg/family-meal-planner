-- Signup approval gate: new accounts must be approved by an admin before
-- they can use the app. Existing accounts are grandfathered in as approved.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- Every row that exists right now predates this column, so it's safe to
-- blanket-approve at migration time; only signups from this point on default
-- to 'pending'.
UPDATE public.users SET approval_status = 'approved' WHERE approval_status = 'pending';

-- Admins need to be able to update other users' role/approval_status, not
-- just their own row.
DROP POLICY IF EXISTS "Admins can update any user" ON public.users;
CREATE POLICY "Admins can update any user" ON public.users
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- The existing "update own profile" policy has no column restriction, so a
-- user could otherwise set their own role/approval_status directly. Enforce
-- that at the trigger level regardless of which policy let the UPDATE through.
CREATE OR REPLACE FUNCTION public.prevent_self_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
      RAISE EXCEPTION 'Only admins can change role or approval_status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_role_approval_admin_only ON public.users;
CREATE TRIGGER enforce_role_approval_admin_only
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_privilege_escalation();
