-- Fix RLS policy for families table to allow inserts during signup
DROP POLICY IF EXISTS "Allow all for authenticated users" ON families;

-- Allow authenticated users to do everything
CREATE POLICY "Allow all for authenticated users" ON families
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
