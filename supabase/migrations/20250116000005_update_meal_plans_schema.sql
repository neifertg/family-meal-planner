-- Update meal_plans table to support multiple meals per day
-- Drop the unique constraint that only allows one meal per day
ALTER TABLE meal_plans DROP CONSTRAINT IF EXISTS meal_plans_family_id_planned_date_key;

-- Add meal_type column to differentiate breakfast, lunch, dinner, snack
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS meal_type TEXT
  CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack'))
  DEFAULT 'dinner';

-- Add notes column for meal-specific notes
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create new unique constraint allowing multiple meals per day (different meal types)
ALTER TABLE meal_plans ADD CONSTRAINT meal_plans_family_date_type_unique
  UNIQUE(family_id, planned_date, meal_type);

-- Create index for meal_type queries
CREATE INDEX IF NOT EXISTS idx_meal_plans_meal_type ON meal_plans(meal_type);
