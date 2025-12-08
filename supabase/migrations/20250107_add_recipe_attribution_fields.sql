-- Add owner and uploaded_by fields to recipes table
ALTER TABLE recipes
ADD COLUMN IF NOT EXISTS owner TEXT,
ADD COLUMN IF NOT EXISTS uploaded_by TEXT;

-- Add comment explaining the fields
COMMENT ON COLUMN recipes.owner IS 'Name of the person who owns/created this recipe (e.g., "Grandma", "Mom")';
COMMENT ON COLUMN recipes.uploaded_by IS 'Name of the person who uploaded/added this recipe to the app';
