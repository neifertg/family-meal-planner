-- Recipe attribution + edit authorization.
--
-- 1. Backfill public.users from auth.users (idempotent). At least one existing
--    recipe creator has no row in public.users, which would silently break the
--    upcoming FK and any display-name join for that user's recipes.
-- 2. Add users.role so "admin" is a real, checkable concept (nothing app-wide
--    existed before this; umbrella_group_memberships.role is a separate,
--    group-scoped concept).
-- 3. Add an FK from recipes.created_by -> public.users(id) so PostgREST can
--    embed the creator's display_name/email directly in a recipe query.
-- 4. Replace the RLS policies on recipes. The live policy set included
--    "Allow all for authenticated users" (FOR ALL, no ownership check) layered
--    on top of an update/delete policy that checked created_by_user_id -- a
--    column that is NULL on every existing row. Permissive policies are OR'd
--    together in Postgres, so in practice any authenticated user could already
--    edit or delete any recipe. This replaces that whole set with policies
--    keyed on created_by, the column the application actually populates.

INSERT INTO public.users (id, email, display_name, avatar_url, created_at)
SELECT
  id,
  email,
  COALESCE(
    raw_user_meta_data->>'display_name',
    raw_user_meta_data->>'full_name',
    email
  ),
  raw_user_meta_data->>'avatar_url',
  created_at
FROM auth.users
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin'));

ALTER TABLE public.recipes
  ADD CONSTRAINT recipes_created_by_users_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

DROP POLICY IF EXISTS "Allow all for authenticated users" ON recipes;
DROP POLICY IF EXISTS "All authenticated users can view recipes" ON recipes;
DROP POLICY IF EXISTS "Authenticated users can create recipes" ON recipes;
DROP POLICY IF EXISTS "Authenticated users can insert recipes" ON recipes;
DROP POLICY IF EXISTS "Users can update their own recipes" ON recipes;
DROP POLICY IF EXISTS "Users can delete their own recipes" ON recipes;
DROP POLICY IF EXISTS "Creators and admins can update recipes" ON recipes;
DROP POLICY IF EXISTS "Creators and admins can delete recipes" ON recipes;

CREATE POLICY "Authenticated users can view recipes" ON recipes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert recipes" ON recipes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Creators and admins can update recipes" ON recipes
  FOR UPDATE USING (
    auth.uid() = created_by
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Creators and admins can delete recipes" ON recipes
  FOR DELETE USING (
    auth.uid() = created_by
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
