-- Fix infinite recursion in umbrella_group_memberships policies (v3)
-- The SELECT policy was still causing recursion
-- This version uses a completely different approach

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Users can read group memberships" ON umbrella_group_memberships;
DROP POLICY IF EXISTS "Members can read group memberships" ON umbrella_group_memberships;
DROP POLICY IF EXISTS "Allow inserting memberships" ON umbrella_group_memberships;
DROP POLICY IF EXISTS "Group creators can update memberships" ON umbrella_group_memberships;
DROP POLICY IF EXISTS "Group creators can delete memberships" ON umbrella_group_memberships;

-- Disable RLS temporarily to avoid any conflicts
ALTER TABLE umbrella_group_memberships DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE umbrella_group_memberships ENABLE ROW LEVEL SECURITY;

-- Simple SELECT policy: Just allow users to see their own membership record
-- This is safe because it doesn't query the same table
CREATE POLICY "Users can read their own memberships" ON umbrella_group_memberships
  FOR SELECT USING (user_id = auth.uid());

-- INSERT: Allow group creators to insert memberships for their groups
-- This allows the trigger to work when creating a group
CREATE POLICY "Group creators can insert memberships" ON umbrella_group_memberships
  FOR INSERT WITH CHECK (
    umbrella_group_id IN (
      SELECT id FROM umbrella_groups WHERE created_by_user_id = auth.uid()
    )
  );

-- UPDATE: Allow group creators to update memberships
CREATE POLICY "Group creators can update memberships" ON umbrella_group_memberships
  FOR UPDATE USING (
    umbrella_group_id IN (
      SELECT id FROM umbrella_groups WHERE created_by_user_id = auth.uid()
    )
  );

-- DELETE: Allow group creators to delete memberships
CREATE POLICY "Group creators can delete memberships" ON umbrella_group_memberships
  FOR DELETE USING (
    umbrella_group_id IN (
      SELECT id FROM umbrella_groups WHERE created_by_user_id = auth.uid()
    )
  );
