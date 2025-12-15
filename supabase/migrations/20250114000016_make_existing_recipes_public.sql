-- Make all existing recipes public
-- This is a one-time migration to set visibility to 'public' for all recipes

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

  RAISE NOTICE 'Updated recipes: % out of % recipes are now public', public_count, total_count;
END $$;
