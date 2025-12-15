-- Fix RLS policies for recipe_umbrella_group_shares
-- Since all recipes are now public, allow group members to share any recipe to their groups

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Users can share their recipes" ON recipe_umbrella_group_shares;

-- Create new permissive policy: group members can share any recipe to their groups
CREATE POLICY "Group members can share recipes" ON recipe_umbrella_group_shares
  FOR INSERT WITH CHECK (
    umbrella_group_id IN (
      SELECT umbrella_group_id FROM umbrella_group_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Update delete policy to allow group members to unshare any recipe (not just their own)
DROP POLICY IF EXISTS "Users can unshare their recipes" ON recipe_umbrella_group_shares;

CREATE POLICY "Group members can unshare recipes" ON recipe_umbrella_group_shares
  FOR DELETE USING (
    umbrella_group_id IN (
      SELECT umbrella_group_id FROM umbrella_group_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Verify policies are updated
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'recipe_umbrella_group_shares'
  AND policyname IN ('Group members can share recipes', 'Group members can unshare recipes');

  IF policy_count = 2 THEN
    RAISE NOTICE 'RLS policies successfully updated for recipe_umbrella_group_shares';
  ELSE
    RAISE WARNING 'Expected 2 policies, found %', policy_count;
  END IF;
END $$;
