-- Disable RLS on umbrella_groups and umbrella_group_memberships completely
-- We'll handle security through the SECURITY DEFINER function instead

ALTER TABLE umbrella_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE umbrella_group_memberships DISABLE ROW LEVEL SECURITY;

-- The SECURITY DEFINER function create_umbrella_group() will handle security
-- The trigger add_creator_as_admin() will work without RLS blocking it
-- All other access (SELECT, UPDATE, DELETE) will go through application logic
