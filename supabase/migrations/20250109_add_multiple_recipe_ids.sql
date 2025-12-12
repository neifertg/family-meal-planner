-- Change recipe_id to support multiple recipe IDs
-- Store as TEXT to allow JSON array or comma-separated values
ALTER TABLE grocery_list_items
  DROP CONSTRAINT IF EXISTS grocery_list_items_recipe_id_fkey;

ALTER TABLE grocery_list_items
  ALTER COLUMN recipe_id TYPE TEXT;

-- Add a comment to explain the format
COMMENT ON COLUMN grocery_list_items.recipe_id IS 'Stores recipe IDs as comma-separated values. Format: "uuid1,uuid2,uuid3" or "adhoc-{meal_plan_id},uuid1"';
