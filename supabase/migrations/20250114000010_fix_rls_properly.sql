-- Re-enable RLS with properly working policies
-- The key insight: WITH CHECK is evaluated on the NEW row being inserted
-- So we check that the created_by_user_id in the NEW row matches auth.uid()

ALTER TABLE umbrella_groups ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can read their groups" ON umbrella_groups;
DROP POLICY IF EXISTS "Users can create groups" ON umbrella_groups;
DROP POLICY IF EXISTS "Allow all authenticated inserts" ON umbrella_groups;
DROP POLICY IF EXISTS "Creators can update groups" ON umbrella_groups;
DROP POLICY IF EXISTS "Creators can delete groups" ON umbrella_groups;

-- SELECT: Users can read groups they're members of
CREATE POLICY "Users can read their groups" ON umbrella_groups
  FOR SELECT USING (
    id IN (
      SELECT umbrella_group_id
      FROM umbrella_group_memberships
      WHERE user_id = auth.uid()
    )
  );

-- INSERT: Users can create groups where they set themselves as creator
-- The WITH CHECK clause evaluates the NEW row, so created_by_user_id
-- should equal the current user's ID
CREATE POLICY "Users can create groups" ON umbrella_groups
  FOR INSERT WITH CHECK (
    created_by_user_id = auth.uid()
  );

-- UPDATE: Only group creators can update
CREATE POLICY "Creators can update groups" ON umbrella_groups
  FOR UPDATE USING (
    created_by_user_id = auth.uid()
  )
  WITH CHECK (
    created_by_user_id = auth.uid()
  );

-- DELETE: Only group creators can delete
CREATE POLICY "Creators can delete groups" ON umbrella_groups
  FOR DELETE USING (
    created_by_user_id = auth.uid()
  );
