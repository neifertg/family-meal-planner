-- Remove user_id column from family_members table since we're not using it
-- We query by family_id instead, which is simpler and works with existing RLS

-- Drop the unique index first
DROP INDEX IF EXISTS idx_family_members_user_id;

-- Drop the lookup index
DROP INDEX IF EXISTS idx_family_members_user_id_lookup;

-- Drop the user_id column
ALTER TABLE family_members
DROP COLUMN IF EXISTS user_id;
