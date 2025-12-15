-- Simplify umbrella_groups INSERT policy
-- The issue might be that created_by_user_id references users table
-- Let's make the policy simpler and more permissive

-- Drop and recreate the INSERT policy
DROP POLICY IF EXISTS "Users can create umbrella groups" ON umbrella_groups;

-- Simple INSERT policy: just check that the user is authenticated
-- and that they're setting themselves as the creator
CREATE POLICY "Authenticated users can create groups" ON umbrella_groups
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = created_by_user_id
  );
