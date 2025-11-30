-- Add created_by column to families table
ALTER TABLE families ADD COLUMN created_by UUID REFERENCES auth.users(id);

-- Create index for better query performance
CREATE INDEX idx_families_created_by ON families(created_by);

-- Update existing families to set created_by (for development data)
-- This won't work in production since we don't know which user created which family
-- For now, just leave existing families with NULL created_by
