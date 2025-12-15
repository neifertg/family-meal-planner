-- Create a SECURITY DEFINER function to create groups
-- This bypasses RLS completely and gives us full control

CREATE OR REPLACE FUNCTION create_umbrella_group(
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_logo_url TEXT DEFAULT NULL,
  p_privacy_level TEXT DEFAULT 'private'
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  logo_url TEXT,
  privacy_level TEXT,
  created_by_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_group_id UUID;
BEGIN
  -- Get the current user ID
  v_user_id := auth.uid();

  -- Verify user is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify user exists in users table
  IF NOT EXISTS (SELECT 1 FROM users WHERE users.id = v_user_id) THEN
    RAISE EXCEPTION 'User not found in users table';
  END IF;

  -- Validate privacy level
  IF p_privacy_level NOT IN ('private', 'public') THEN
    RAISE EXCEPTION 'Invalid privacy level. Must be private or public';
  END IF;

  -- Insert the group (bypasses RLS because of SECURITY DEFINER)
  INSERT INTO umbrella_groups (name, description, logo_url, privacy_level, created_by_user_id)
  VALUES (p_name, p_description, p_logo_url, p_privacy_level, v_user_id)
  RETURNING
    umbrella_groups.id,
    umbrella_groups.name,
    umbrella_groups.description,
    umbrella_groups.logo_url,
    umbrella_groups.privacy_level,
    umbrella_groups.created_by_user_id,
    umbrella_groups.created_at
  INTO
    v_group_id,
    create_umbrella_group.name,
    create_umbrella_group.description,
    create_umbrella_group.logo_url,
    create_umbrella_group.privacy_level,
    create_umbrella_group.created_by_user_id,
    create_umbrella_group.created_at;

  -- Set the id for return
  create_umbrella_group.id := v_group_id;

  -- The trigger will automatically add the user as admin to umbrella_group_memberships

  RETURN NEXT;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_umbrella_group(TEXT, TEXT, TEXT, TEXT) TO authenticated;
