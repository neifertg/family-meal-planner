-- Add support for multiple recipes per meal slot
-- This allows big meals that require multiple recipes

-- Create junction table for meal plans and recipes (many-to-many relationship)
CREATE TABLE IF NOT EXISTS meal_plan_recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(meal_plan_id, recipe_id)
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_meal_plan_recipes_meal_plan ON meal_plan_recipes(meal_plan_id);
CREATE INDEX IF NOT EXISTS idx_meal_plan_recipes_recipe ON meal_plan_recipes(recipe_id);

-- Remove the check constraint that enforced either recipe_id OR adhoc_meal_name
-- This allows meals to have multiple recipes AND/OR adhoc ingredients
ALTER TABLE meal_plans DROP CONSTRAINT IF EXISTS meal_plans_type_check;

-- Add new check constraint that's more flexible:
-- A meal must have at least ONE of: recipe_id, adhoc_meal_name, or entries in meal_plan_recipes
-- Note: We can't enforce meal_plan_recipes in a check constraint, so we'll handle validation in the app
ALTER TABLE meal_plans ADD CONSTRAINT meal_plans_has_content_check
  CHECK (
    recipe_id IS NOT NULL OR
    adhoc_meal_name IS NOT NULL
  );

-- Migrate existing recipe_id values to the meal_plan_recipes table
INSERT INTO meal_plan_recipes (meal_plan_id, recipe_id, display_order)
SELECT id, recipe_id, 0
FROM meal_plans
WHERE recipe_id IS NOT NULL
ON CONFLICT (meal_plan_id, recipe_id) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE meal_plan_recipes IS 'Junction table allowing multiple recipes per meal slot. Use display_order to control the order recipes appear in the UI.';
COMMENT ON COLUMN meal_plans.recipe_id IS 'DEPRECATED: Use meal_plan_recipes table instead. Kept for backward compatibility during migration.';
