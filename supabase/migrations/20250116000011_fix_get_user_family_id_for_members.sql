-- Fix get_user_family_id() to work for ALL family members, not just creators
-- This function is critical for RLS policies - it must return the family_id for any family member
--
-- Background: A previous migration incorrectly changed this function to look up families.created_by
-- instead of family_members.user_id, which broke RLS for all non-creator family members.

-- Use CREATE OR REPLACE instead of DROP to avoid cascade issues with RLS policies
CREATE OR REPLACE FUNCTION get_user_family_id()
RETURNS UUID AS $$
BEGIN
  -- Get family_id from family_members table (works for all members, not just creator)
  RETURN (
    SELECT family_id
    FROM family_members
    WHERE user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_user_family_id IS 'Returns the family_id for the currently authenticated user by looking up their family_members record. This works for ALL family members, not just the creator. Used by RLS policies throughout the application.';
