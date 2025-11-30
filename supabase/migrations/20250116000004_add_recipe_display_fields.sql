-- Add display fields to recipes table for UI filtering and presentation
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS cuisine TEXT;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS total_time_minutes INTEGER;

-- Create indexes for better query performance on filters
CREATE INDEX IF NOT EXISTS idx_recipes_cuisine ON recipes(cuisine);
CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category);
CREATE INDEX IF NOT EXISTS idx_recipes_created_by ON recipes(created_by);

-- Update photo_url data to image_url for existing records
UPDATE recipes SET image_url = photo_url WHERE photo_url IS NOT NULL AND image_url IS NULL;

-- Calculate total_time_minutes for existing records
UPDATE recipes
SET total_time_minutes = COALESCE(prep_time_minutes, 0) + COALESCE(cook_time_minutes, 0)
WHERE total_time_minutes IS NULL AND (prep_time_minutes IS NOT NULL OR cook_time_minutes IS NOT NULL);
