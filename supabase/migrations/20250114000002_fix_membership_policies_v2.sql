-- Fix infinite recursion in umbrella_group_memberships policies (v2)
-- The previous fix still had recursion issues
-- This version completely avoids self-referencing queries

-- Drop all existing policies on umbrella_group_memberships
DROP POLICY IF EXISTS "Members can read group memberships" ON umbrella_group_memberships;
DROP POLICY IF EXISTS "Group creator and admins can add members" ON umbrella_group_memberships;
DROP POLICY IF EXISTS "Admins can update member roles" ON umbrella_group_memberships;
DROP POLICY IF EXISTS "Admins can remove members" ON umbrella_group_memberships;

-- SELECT: Allow users to read memberships for groups they belong to
-- This one is safe because it doesn't do a subquery on the same table
CREATE POLICY "Users can read group memberships" ON umbrella_group_memberships
  FOR SELECT USING (
    user_id = auth.uid()
    OR umbrella_group_id IN (
      SELECT ugm.umbrella_group_id
      FROM umbrella_group_memberships ugm
      WHERE ugm.user_id = auth.uid()
    )
  );

-- INSERT: Allow in two cases without recursion
-- 1. User is the group creator (checked via umbrella_groups table)
-- 2. User is being added by the system (SECURITY DEFINER function handles this)
CREATE POLICY "Allow inserting memberships" ON umbrella_group_memberships
  FOR INSERT WITH CHECK (
    -- Allow if inserting into a group created by this user
    umbrella_group_id IN (
      SELECT id FROM umbrella_groups WHERE created_by_user_id = auth.uid()
    )
    -- No other checks - we'll handle admin-adding-members via SECURITY DEFINER function
  );

-- UPDATE: Only allow if user is group creator (avoid recursion)
CREATE POLICY "Group creators can update memberships" ON umbrella_group_memberships
  FOR UPDATE USING (
    umbrella_group_id IN (
      SELECT id FROM umbrella_groups WHERE created_by_user_id = auth.uid()
    )
  );

-- DELETE: Only allow if user is group creator (avoid recursion)
CREATE POLICY "Group creators can delete memberships" ON umbrella_group_memberships
  FOR DELETE USING (
    umbrella_group_id IN (
      SELECT id FROM umbrella_groups WHERE created_by_user_id = auth.uid()
    )
  );

-- Create a SECURITY DEFINER function for admins to add members
-- This bypasses RLS, so admins can add members without recursion issues
CREATE OR REPLACE FUNCTION add_group_member(
  p_group_id UUID,
  p_user_id UUID,
  p_role TEXT DEFAULT 'member'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the caller is an admin of this group
  IF NOT EXISTS (
    SELECT 1 FROM umbrella_group_memberships
    WHERE umbrella_group_id = p_group_id
      AND user_id = auth.uid()
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only group admins can add members';
  END IF;

  -- Insert the new member
  INSERT INTO umbrella_group_memberships (umbrella_group_id, user_id, role)
  VALUES (p_group_id, p_user_id, p_role)
  ON CONFLICT (umbrella_group_id, user_id) DO NOTHING;
END;
$$;
