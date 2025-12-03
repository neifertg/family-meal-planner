-- Add age and photo_url fields to family_members table
ALTER TABLE family_members
ADD COLUMN age INTEGER,
ADD COLUMN photo_url TEXT;

-- Add guest_count field to meal_plans table
ALTER TABLE meal_plans
ADD COLUMN guest_count INTEGER DEFAULT 0;
