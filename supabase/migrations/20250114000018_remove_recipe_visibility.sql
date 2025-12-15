-- Remove the visibility column from recipes table
-- All recipes are now public and can be assigned to groups

-- Drop the visibility column and its constraint
ALTER TABLE recipes
DROP COLUMN IF EXISTS visibility;

-- Verify the column was dropped
DO $$
DECLARE
  column_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'recipes'
    AND column_name = 'visibility'
  ) INTO column_exists;

  IF column_exists THEN
    RAISE EXCEPTION 'visibility column still exists on recipes table';
  ELSE
    RAISE NOTICE 'visibility column successfully removed from recipes table';
  END IF;
END $$;
