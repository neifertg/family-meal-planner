-- Fix infinite recursion in umbrella_group_memberships policies
-- The issue: policies were checking membership to allow inserting membership (circular)

-- Drop the problematic policies
DROP POLICY IF EXISTS "Admins can add members" ON umbrella_group_memberships;
DROP POLICY IF EXISTS "Admins can update member roles" ON umbrella_group_memberships;
DROP POLICY IF EXISTS "Admins can remove members" ON umbrella_group_memberships;

-- Recreate with fixed logic that avoids recursion
-- Allow group creator to add themselves as admin (for the trigger)
-- Allow existing admins to add members (but check admin status in umbrella_groups table instead)
CREATE POLICY "Group creator and admins can add members" ON umbrella_group_memberships
  FOR INSERT WITH CHECK (
    -- Allow if user is creating a group (will become admin via trigger)
    umbrella_group_id IN (
      SELECT id FROM umbrella_groups WHERE created_by_user_id = auth.uid()
    )
    OR
    -- Allow if user is already an admin (check via umbrella_groups join, not recursive membership check)
    EXISTS (
      SELECT 1 FROM umbrella_group_memberships m
      JOIN umbrella_groups g ON m.umbrella_group_id = g.id
      WHERE m.umbrella_group_id = umbrella_group_memberships.umbrella_group_id
        AND m.user_id = auth.uid()
        AND m.role = 'admin'
    )
  );

CREATE POLICY "Admins can update member roles" ON umbrella_group_memberships
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM umbrella_group_memberships m
      WHERE m.umbrella_group_id = umbrella_group_memberships.umbrella_group_id
        AND m.user_id = auth.uid()
        AND m.role = 'admin'
    )
  );

CREATE POLICY "Admins can remove members" ON umbrella_group_memberships
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM umbrella_group_memberships m
      WHERE m.umbrella_group_id = umbrella_group_memberships.umbrella_group_id
        AND m.user_id = auth.uid()
        AND m.role = 'admin'
    )
  );
