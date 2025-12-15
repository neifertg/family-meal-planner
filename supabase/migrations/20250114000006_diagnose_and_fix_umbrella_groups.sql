-- Diagnose and fix umbrella_groups RLS policies
-- Drop ALL existing policies to start fresh

DROP POLICY IF EXISTS "Users can read groups they are members of" ON umbrella_groups;
DROP POLICY IF EXISTS "Users can create umbrella groups" ON umbrella_groups;
DROP POLICY IF EXISTS "Authenticated users can create groups" ON umbrella_groups;
DROP POLICY IF EXISTS "Group creators can update their groups" ON umbrella_groups;
DROP POLICY IF EXISTS "Group creators can delete their groups" ON umbrella_groups;

-- Ensure RLS is enabled
ALTER TABLE umbrella_groups ENABLE ROW LEVEL SECURITY;

-- Create simple, non-conflicting policies

-- SELECT: Users can read groups they're members of
CREATE POLICY "Users can read their groups" ON umbrella_groups
  FOR SELECT USING (
    id IN (
      SELECT umbrella_group_id
      FROM umbrella_group_memberships
      WHERE user_id = auth.uid()
    )
  );

-- INSERT: Authenticated users can create groups
-- This is the critical one - must allow the insert to happen
CREATE POLICY "Users can create groups" ON umbrella_groups
  FOR INSERT WITH CHECK (
    auth.uid() = created_by_user_id
  );

-- UPDATE: Only group creators can update
CREATE POLICY "Creators can update groups" ON umbrella_groups
  FOR UPDATE USING (
    created_by_user_id = auth.uid()
  );

-- DELETE: Only group creators can delete
CREATE POLICY "Creators can delete groups" ON umbrella_groups
  FOR DELETE USING (
    created_by_user_id = auth.uid()
  );
