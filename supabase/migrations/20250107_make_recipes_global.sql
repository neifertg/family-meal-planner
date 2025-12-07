-- Make recipes globally shared across all families
-- This migration removes family_id from recipes and adds user tracking instead

-- Step 1: Add created_by_user_id column to track who created the recipe
ALTER TABLE recipes
ADD COLUMN created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Step 2: Migrate existing data - set created_by_user_id based on family's creator
-- For existing recipes, we'll try to find the user who created the family
UPDATE recipes r
SET created_by_user_id = (
  SELECT fm.user_id
  FROM family_members fm
  WHERE fm.family_id = r.family_id
  LIMIT 1
)
WHERE created_by_user_id IS NULL;

-- Step 3: Drop the family_id constraint and column
ALTER TABLE recipes DROP CONSTRAINT recipes_family_id_fkey;
ALTER TABLE recipes DROP COLUMN family_id;

-- Step 4: Update RLS policies for recipes table
DROP POLICY IF EXISTS "Users can view their family's recipes" ON recipes;
DROP POLICY IF EXISTS "Users can insert recipes for their family" ON recipes;
DROP POLICY IF EXISTS "Users can update their family's recipes" ON recipes;
DROP POLICY IF EXISTS "Users can delete their family's recipes" ON recipes;

-- New RLS policies: All authenticated users can view all recipes
CREATE POLICY "All authenticated users can view recipes" ON recipes
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only the creator can update their own recipes
CREATE POLICY "Users can update their own recipes" ON recipes
  FOR UPDATE USING (auth.uid() = created_by_user_id);

-- Only the creator can delete their own recipes
CREATE POLICY "Users can delete their own recipes" ON recipes
  FOR DELETE USING (auth.uid() = created_by_user_id);

-- Anyone can create recipes
CREATE POLICY "Authenticated users can create recipes" ON recipes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Step 5: Update recipe_ratings to be family-scoped instead of global
-- Ratings should still be per family, not global
-- (No changes needed - recipe_ratings already has family_member_id which is family-scoped)

-- Step 6: Update meal_plans - these should remain family-scoped
-- (No changes needed - meal_plans already has family_id)

-- Create index on created_by_user_id for better query performance
CREATE INDEX IF NOT EXISTS idx_recipes_created_by_user ON recipes(created_by_user_id);
