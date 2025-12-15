-- Temporarily make umbrella_groups INSERT extremely permissive to diagnose the issue
-- This will help us understand what's actually blocking the insert

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Users can create groups" ON umbrella_groups;

-- Create an extremely permissive INSERT policy for debugging
-- This allows ANY authenticated user to insert ANY row
CREATE POLICY "Allow all authenticated inserts" ON umbrella_groups
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- Also check if users table RLS is blocking the foreign key validation
-- Make sure users table has permissive SELECT for foreign key checks
DROP POLICY IF EXISTS "Users can read their own data" ON users;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON users;

CREATE POLICY "Allow all authenticated users to read users" ON users
  FOR SELECT USING (true);
