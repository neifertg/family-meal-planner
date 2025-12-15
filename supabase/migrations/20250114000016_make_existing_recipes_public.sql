-- Add visibility column to recipes table if it doesn't exist
-- Then make all existing recipes public

-- Add visibility column
ALTER TABLE recipes
ADD COLUMN IF NOT EXISTS visibility TEXT
CHECK (visibility IN ('public', 'private'))
DEFAULT 'public';

-- Set all existing recipes to public (this ensures any NULL values are updated)
UPDATE recipes
SET visibility = 'public'
WHERE visibility IS NULL OR visibility != 'public';

-- Verify the update
DO $$
DECLARE
  public_count INTEGER;
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO public_count FROM recipes WHERE visibility = 'public';
  SELECT COUNT(*) INTO total_count FROM recipes;

  RAISE NOTICE 'Recipe visibility: % out of % recipes are now public', public_count, total_count;
END $$;
