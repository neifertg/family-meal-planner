-- Fix RLS policy for families table to filter by created_by
DROP POLICY IF EXISTS "Allow all for authenticated users" ON families;

-- Allow users to see only their own family
CREATE POLICY "Users can view their own family" ON families
  FOR SELECT
  USING (created_by = auth.uid());

-- Allow users to insert their own family
CREATE POLICY "Users can create their own family" ON families
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Allow users to update their own family
CREATE POLICY "Users can update their own family" ON families
  FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Allow users to delete their own family
CREATE POLICY "Users can delete their own family" ON families
  FOR DELETE
  USING (created_by = auth.uid());
