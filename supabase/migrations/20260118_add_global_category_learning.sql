-- Migration: Add global ingredient category learning system
-- Description: Create table for community-driven category preferences that benefit all users
-- Date: 2026-01-18

-- Create table for global category preferences (shared across all users)
CREATE TABLE IF NOT EXISTS global_ingredient_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('produce', 'dairy', 'meat', 'frozen', 'pantry', 'other')),
  vote_count INTEGER NOT NULL DEFAULT 1,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Index for fast lookups
  CONSTRAINT global_ingredient_categories_ingredient_name_key UNIQUE (ingredient_name)
);

-- Create index for ingredient name lookups
CREATE INDEX IF NOT EXISTS idx_global_ingredient_categories_name
  ON global_ingredient_categories(ingredient_name);

-- Create index for popular items (frequently categorized)
CREATE INDEX IF NOT EXISTS idx_global_ingredient_categories_votes
  ON global_ingredient_categories(vote_count DESC);

-- Enable Row Level Security
ALTER TABLE global_ingredient_categories ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read global preferences
CREATE POLICY "All users can view global category preferences"
  ON global_ingredient_categories
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: All authenticated users can insert new global preferences
CREATE POLICY "All users can contribute to global category preferences"
  ON global_ingredient_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: All authenticated users can update global preferences (vote counting)
CREATE POLICY "All users can update global category preferences"
  ON global_ingredient_categories
  FOR UPDATE
  TO authenticated
  USING (true);

-- Add comment
COMMENT ON TABLE global_ingredient_categories IS 'Community-driven ingredient categorization that learns from all users to improve accuracy for everyone';
COMMENT ON COLUMN global_ingredient_categories.vote_count IS 'Number of times this categorization has been confirmed by users across all families';

-- Function to increment vote count when users agree with a category
CREATE OR REPLACE FUNCTION increment_global_category_vote(
  p_ingredient_name TEXT,
  p_category TEXT
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO global_ingredient_categories (ingredient_name, category, vote_count)
  VALUES (p_ingredient_name, p_category, 1)
  ON CONFLICT (ingredient_name)
  DO UPDATE SET
    -- If category matches, increment vote count
    vote_count = CASE
      WHEN global_ingredient_categories.category = p_category
      THEN global_ingredient_categories.vote_count + 1
      -- If category changed and new category has more "support", update it
      -- For now, just increment if it matches
      ELSE global_ingredient_categories.vote_count
    END,
    last_updated = NOW();
END;
$$;

COMMENT ON FUNCTION increment_global_category_vote IS 'Increments vote count for a global ingredient category preference, creating it if it does not exist';
