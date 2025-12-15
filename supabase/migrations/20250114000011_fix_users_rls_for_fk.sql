-- Fix users table RLS to allow foreign key validation
-- The issue: When inserting into umbrella_groups with created_by_user_id,
-- PostgreSQL needs to SELECT from users table to validate the foreign key exists.
-- But the existing RLS policy only allowed "auth.uid() = id", blocking the check.

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Allow all authenticated users to read users" ON users;
DROP POLICY IF EXISTS "Public users read" ON users;

-- Create a policy that allows:
-- 1. Users to read their own profile
-- 2. System to validate foreign keys (important!)
-- We do this by making SELECT permissive for authenticated users
CREATE POLICY "Authenticated users can read user profiles" ON users
  FOR SELECT USING (true);

-- Keep the update policy
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Now re-enable umbrella_groups RLS with proper policies
ALTER TABLE umbrella_groups ENABLE ROW LEVEL SECURITY;

-- Drop any test policies
DROP POLICY IF EXISTS "Allow all authenticated inserts" ON umbrella_groups;
DROP POLICY IF EXISTS "Users can create groups" ON umbrella_groups;
DROP POLICY IF EXISTS "Users can create umbrella groups" ON umbrella_groups;
DROP POLICY IF EXISTS "Users can read their groups" ON umbrella_groups;
DROP POLICY IF EXISTS "Creators can update groups" ON umbrella_groups;
DROP POLICY IF EXISTS "Creators can delete groups" ON umbrella_groups;
DROP POLICY IF EXISTS "Members can read their umbrella groups" ON umbrella_groups;
DROP POLICY IF EXISTS "Admins can update their umbrella groups" ON umbrella_groups;
DROP POLICY IF EXISTS "Admins can delete their umbrella groups" ON umbrella_groups;

-- Recreate proper policies matching the original schema
CREATE POLICY "Members can read their umbrella groups" ON umbrella_groups
  FOR SELECT USING (
    id IN (
      SELECT umbrella_group_id FROM umbrella_group_memberships
      WHERE user_id = auth.uid()
    )
    OR privacy_level = 'public'
  );

CREATE POLICY "Users can create umbrella groups" ON umbrella_groups
  FOR INSERT WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Admins can update their umbrella groups" ON umbrella_groups
  FOR UPDATE USING (
    id IN (
      SELECT umbrella_group_id FROM umbrella_group_memberships
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete their umbrella groups" ON umbrella_groups
  FOR DELETE USING (
    id IN (
      SELECT umbrella_group_id FROM umbrella_group_memberships
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
