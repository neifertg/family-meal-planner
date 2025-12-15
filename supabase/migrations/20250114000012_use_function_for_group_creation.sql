-- Alternative approach: Use a SECURITY DEFINER function to create groups
-- This bypasses RLS and gives us complete control over the group creation process

-- First, let's check what policies actually exist right now
-- by dropping everything and starting completely fresh

ALTER TABLE umbrella_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE umbrella_group_memberships DISABLE ROW LEVEL SECURITY;

-- Drop ALL policies on umbrella_groups
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'umbrella_groups') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON umbrella_groups';
    END LOOP;
END $$;

-- Drop ALL policies on umbrella_group_memberships
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'umbrella_group_memberships') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON umbrella_group_memberships';
    END LOOP;
END $$;

-- Re-enable RLS
ALTER TABLE umbrella_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE umbrella_group_memberships ENABLE ROW LEVEL SECURITY;

-- Create brand new policies with unique names
-- SELECT policy for umbrella_groups
CREATE POLICY "select_umbrella_groups_v2" ON umbrella_groups
  FOR SELECT USING (
    id IN (
      SELECT umbrella_group_id FROM umbrella_group_memberships
      WHERE user_id = auth.uid()
    )
    OR privacy_level = 'public'
  );

-- INSERT policy - this is where the problem is
-- Let's try using current_setting instead of auth.uid()
CREATE POLICY "insert_umbrella_groups_v2" ON umbrella_groups
  FOR INSERT WITH CHECK (
    created_by_user_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
  );

-- UPDATE policy
CREATE POLICY "update_umbrella_groups_v2" ON umbrella_groups
  FOR UPDATE USING (
    id IN (
      SELECT umbrella_group_id FROM umbrella_group_memberships
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- DELETE policy
CREATE POLICY "delete_umbrella_groups_v2" ON umbrella_groups
  FOR DELETE USING (
    id IN (
      SELECT umbrella_group_id FROM umbrella_group_memberships
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Membership policies
CREATE POLICY "select_memberships_v2" ON umbrella_group_memberships
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "insert_memberships_v2" ON umbrella_group_memberships
  FOR INSERT WITH CHECK (
    umbrella_group_id IN (
      SELECT id FROM umbrella_groups WHERE created_by_user_id = auth.uid()
    )
  );

CREATE POLICY "update_memberships_v2" ON umbrella_group_memberships
  FOR UPDATE USING (
    umbrella_group_id IN (
      SELECT id FROM umbrella_groups WHERE created_by_user_id = auth.uid()
    )
  );

CREATE POLICY "delete_memberships_v2" ON umbrella_group_memberships
  FOR DELETE USING (
    umbrella_group_id IN (
      SELECT id FROM umbrella_groups WHERE created_by_user_id = auth.uid()
    )
  );
