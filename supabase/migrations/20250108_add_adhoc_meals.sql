-- Add support for adhoc meals (meals without recipes)
-- This allows users to add simple meals like "leftovers" or "eggs and toast"

-- Make recipe_id nullable (it was previously NOT NULL)
ALTER TABLE meal_plans ALTER COLUMN recipe_id DROP NOT NULL;

-- Add adhoc meal fields
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS adhoc_meal_name TEXT;
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS adhoc_ingredients JSONB;

-- Add check constraint to ensure either recipe_id OR adhoc_meal_name is provided
-- This ensures every meal is either a recipe-based meal or an adhoc meal, not both or neither
ALTER TABLE meal_plans ADD CONSTRAINT meal_plans_type_check
  CHECK (
    (recipe_id IS NOT NULL AND adhoc_meal_name IS NULL) OR
    (recipe_id IS NULL AND adhoc_meal_name IS NOT NULL)
  );

-- Add comments for documentation
COMMENT ON COLUMN meal_plans.adhoc_meal_name IS 'Name of adhoc meal (e.g., "Leftovers", "Eggs and Toast"). Mutually exclusive with recipe_id.';
COMMENT ON COLUMN meal_plans.adhoc_ingredients IS 'JSON array of ingredient names for adhoc meals. Format: ["ingredient 1", "ingredient 2"]. Only used when adhoc_meal_name is set.';
