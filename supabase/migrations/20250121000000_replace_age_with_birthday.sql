-- Replace age field with birthday field in family_members table
-- This allows automatic age calculation and more accurate tracking

-- Add birthday field
ALTER TABLE family_members
ADD COLUMN birthday DATE;

-- Drop age field
ALTER TABLE family_members
DROP COLUMN IF EXISTS age;

-- Add comment explaining the change
COMMENT ON COLUMN family_members.birthday IS 'Birth date of the family member. Age is calculated automatically from this value.';
