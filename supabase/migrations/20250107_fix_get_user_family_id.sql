-- Fix the get_user_family_id() function to use families.created_by instead of family_members.user_id
-- The user_id column was removed from family_members, so we need to look up via families table

CREATE OR REPLACE FUNCTION get_user_family_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT id
    FROM families
    WHERE created_by = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_family_id IS 'Returns the family_id for the currently authenticated user by looking up the family they created. Used by RLS policies to restrict data access to family members only.';
