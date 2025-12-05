-- This migration ensures that a default family exists for the user
-- If you're logged in but don't have a family, this will help diagnose the issue

-- Note: This is a diagnostic query. You'll need to manually create a family
-- through the Supabase dashboard if one doesn't exist.

-- To create a family manually in Supabase SQL Editor, run:
-- INSERT INTO families (name, created_by)
-- VALUES ('My Family', auth.uid());
