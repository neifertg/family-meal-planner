-- Forcefully disable RLS and drop all policies
-- This ensures no RLS interference with group creation

-- Drop all policies on umbrella_groups
DROP POLICY IF EXISTS "delete_umbrella_groups_v2" ON umbrella_groups;
DROP POLICY IF EXISTS "insert_umbrella_groups_v2" ON umbrella_groups;
DROP POLICY IF EXISTS "select_umbrella_groups_v2" ON umbrella_groups;
DROP POLICY IF EXISTS "update_umbrella_groups_v2" ON umbrella_groups;

-- Drop all policies on umbrella_group_memberships
DROP POLICY IF EXISTS "delete_memberships_v2" ON umbrella_group_memberships;
DROP POLICY IF EXISTS "insert_memberships_v2" ON umbrella_group_memberships;
DROP POLICY IF EXISTS "select_memberships_v2" ON umbrella_group_memberships;
DROP POLICY IF EXISTS "update_memberships_v2" ON umbrella_group_memberships;

-- DISABLE RLS
ALTER TABLE umbrella_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE umbrella_group_memberships DISABLE ROW LEVEL SECURITY;

-- Verify it worked
DO $$
DECLARE
  ug_rls BOOLEAN;
  ugm_rls BOOLEAN;
BEGIN
  SELECT rowsecurity INTO ug_rls FROM pg_tables WHERE tablename = 'umbrella_groups';
  SELECT rowsecurity INTO ugm_rls FROM pg_tables WHERE tablename = 'umbrella_group_memberships';

  IF ug_rls THEN
    RAISE EXCEPTION 'umbrella_groups still has RLS enabled!';
  END IF;

  IF ugm_rls THEN
    RAISE EXCEPTION 'umbrella_group_memberships still has RLS enabled!';
  END IF;

  RAISE NOTICE 'RLS successfully disabled on both tables';
END $$;
