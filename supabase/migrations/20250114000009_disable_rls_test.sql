-- Temporarily disable RLS on umbrella_groups to test if that's the issue
-- This will help us confirm if it's an RLS problem or something else

-- Disable RLS entirely
ALTER TABLE umbrella_groups DISABLE ROW LEVEL SECURITY;

-- Also make sure users table allows reads for foreign key validation
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated users to read users" ON users;

CREATE POLICY "Public users read" ON users
  FOR SELECT USING (true);
