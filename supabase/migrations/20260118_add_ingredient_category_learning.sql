-- Migration: Add ingredient category learning system
-- Description: Create table to store user-learned category preferences for ingredients
-- Date: 2026-01-18

-- Create table for storing learned ingredient category preferences
CREATE TABLE IF NOT EXISTS ingredient_category_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('produce', 'dairy', 'meat', 'frozen', 'pantry', 'other')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure one preference per ingredient per family
  UNIQUE(family_id, ingredient_name)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ingredient_category_prefs_family
  ON ingredient_category_preferences(family_id);

-- Create index for ingredient name lookups
CREATE INDEX IF NOT EXISTS idx_ingredient_category_prefs_name
  ON ingredient_category_preferences(ingredient_name);

-- Enable Row Level Security
ALTER TABLE ingredient_category_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see preferences for their own family
CREATE POLICY "Users can view their family's category preferences"
  ON ingredient_category_preferences
  FOR SELECT
  USING (family_id = get_user_family_id());

-- Policy: Users can insert preferences for their own family
CREATE POLICY "Users can insert category preferences for their family"
  ON ingredient_category_preferences
  FOR INSERT
  WITH CHECK (family_id = get_user_family_id());

-- Policy: Users can update their family's preferences
CREATE POLICY "Users can update their family's category preferences"
  ON ingredient_category_preferences
  FOR UPDATE
  USING (family_id = get_user_family_id());

-- Policy: Users can delete their family's preferences
CREATE POLICY "Users can delete their family's category preferences"
  ON ingredient_category_preferences
  FOR DELETE
  USING (family_id = get_user_family_id());

-- Add comment
COMMENT ON TABLE ingredient_category_preferences IS 'Stores user-learned category preferences for ingredients to improve automatic categorization';
