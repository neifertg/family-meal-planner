-- Umbrella Groups Migration
-- Creates the infrastructure for extended family recipe sharing

-- ============================================================================
-- 1. USERS TABLE (Linked to Supabase Auth)
-- ============================================================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 2. UMBRELLA GROUPS (Extended Family Groups)
-- ============================================================================
CREATE TABLE umbrella_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  privacy_level TEXT NOT NULL CHECK (privacy_level IN ('private', 'public')) DEFAULT 'private',
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 3. UMBRELLA GROUP MEMBERSHIPS
-- ============================================================================
CREATE TABLE umbrella_group_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  umbrella_group_id UUID NOT NULL REFERENCES umbrella_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')) DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(umbrella_group_id, user_id)
);

-- ============================================================================
-- 4. FAMILY-UMBRELLA GROUP RELATIONSHIPS
-- ============================================================================
CREATE TABLE family_umbrella_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  umbrella_group_id UUID NOT NULL REFERENCES umbrella_groups(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(family_id, umbrella_group_id)
);

-- ============================================================================
-- 5. GROUP INVITATIONS
-- ============================================================================
CREATE TABLE umbrella_group_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  umbrella_group_id UUID NOT NULL REFERENCES umbrella_groups(id) ON DELETE CASCADE,
  invited_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'expired')) DEFAULT 'pending',
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  responded_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- 6. UPDATE RECIPES TABLE
-- ============================================================================
-- Add creator tracking to recipes
ALTER TABLE recipes ADD COLUMN created_by_user_id UUID REFERENCES users(id);

-- Add group ownership flag
ALTER TABLE recipes ADD COLUMN is_group_owned BOOLEAN DEFAULT false;

-- ============================================================================
-- 7. RECIPE-UMBRELLA GROUP SHARES
-- ============================================================================
CREATE TABLE recipe_umbrella_group_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  umbrella_group_id UUID NOT NULL REFERENCES umbrella_groups(id) ON DELETE CASCADE,
  shared_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(recipe_id, umbrella_group_id)
);

-- ============================================================================
-- 8. UMBRELLA GROUP RECIPE RATINGS
-- ============================================================================
CREATE TABLE umbrella_group_recipe_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  umbrella_group_id UUID NOT NULL REFERENCES umbrella_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(recipe_id, umbrella_group_id, user_id)
);

-- ============================================================================
-- 9. INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_umbrella_groups_created_by ON umbrella_groups(created_by_user_id);
CREATE INDEX idx_umbrella_group_memberships_group ON umbrella_group_memberships(umbrella_group_id);
CREATE INDEX idx_umbrella_group_memberships_user ON umbrella_group_memberships(user_id);
CREATE INDEX idx_family_umbrella_groups_family ON family_umbrella_groups(family_id);
CREATE INDEX idx_family_umbrella_groups_umbrella ON family_umbrella_groups(umbrella_group_id);
CREATE INDEX idx_umbrella_group_invitations_group ON umbrella_group_invitations(umbrella_group_id);
CREATE INDEX idx_umbrella_group_invitations_email ON umbrella_group_invitations(email);
CREATE INDEX idx_umbrella_group_invitations_status ON umbrella_group_invitations(status);
CREATE INDEX idx_recipe_shares_recipe ON recipe_umbrella_group_shares(recipe_id);
CREATE INDEX idx_recipe_shares_group ON recipe_umbrella_group_shares(umbrella_group_id);
CREATE INDEX idx_umbrella_group_ratings_recipe ON umbrella_group_recipe_ratings(recipe_id);
CREATE INDEX idx_umbrella_group_ratings_group ON umbrella_group_recipe_ratings(umbrella_group_id);
CREATE INDEX idx_umbrella_group_ratings_user ON umbrella_group_recipe_ratings(user_id);
CREATE INDEX idx_recipes_created_by_user ON recipes(created_by_user_id);

-- ============================================================================
-- 10. UPDATE TRIGGERS
-- ============================================================================
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_umbrella_groups_updated_at BEFORE UPDATE ON umbrella_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_umbrella_group_ratings_updated_at BEFORE UPDATE ON umbrella_group_recipe_ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 11. ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE umbrella_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE umbrella_group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_umbrella_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE umbrella_group_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_umbrella_group_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE umbrella_group_recipe_ratings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 12. RLS POLICIES
-- ============================================================================

-- Users: Can read their own record and other users in their groups
CREATE POLICY "Users can read own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Umbrella Groups: Members can read their groups
CREATE POLICY "Members can read their umbrella groups" ON umbrella_groups
  FOR SELECT USING (
    id IN (
      SELECT umbrella_group_id FROM umbrella_group_memberships
      WHERE user_id = auth.uid()
    )
    OR privacy_level = 'public'
  );

CREATE POLICY "Users can create umbrella groups" ON umbrella_groups
  FOR INSERT WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Admins can update their umbrella groups" ON umbrella_groups
  FOR UPDATE USING (
    id IN (
      SELECT umbrella_group_id FROM umbrella_group_memberships
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete their umbrella groups" ON umbrella_groups
  FOR DELETE USING (
    id IN (
      SELECT umbrella_group_id FROM umbrella_group_memberships
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Umbrella Group Memberships: Members can read, admins can manage
CREATE POLICY "Members can read group memberships" ON umbrella_group_memberships
  FOR SELECT USING (
    umbrella_group_id IN (
      SELECT umbrella_group_id FROM umbrella_group_memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can add members" ON umbrella_group_memberships
  FOR INSERT WITH CHECK (
    umbrella_group_id IN (
      SELECT umbrella_group_id FROM umbrella_group_memberships
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update member roles" ON umbrella_group_memberships
  FOR UPDATE USING (
    umbrella_group_id IN (
      SELECT umbrella_group_id FROM umbrella_group_memberships
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can remove members" ON umbrella_group_memberships
  FOR DELETE USING (
    umbrella_group_id IN (
      SELECT umbrella_group_id FROM umbrella_group_memberships
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Family-Umbrella Group Links: Members can read
CREATE POLICY "Members can read family-group links" ON family_umbrella_groups
  FOR SELECT USING (
    umbrella_group_id IN (
      SELECT umbrella_group_id FROM umbrella_group_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Invitations: Inviter and invitee can read, admins can manage
CREATE POLICY "Users can read invitations for their groups or email" ON umbrella_group_invitations
  FOR SELECT USING (
    email = (SELECT email FROM users WHERE id = auth.uid())
    OR umbrella_group_id IN (
      SELECT umbrella_group_id FROM umbrella_group_memberships
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can create invitations" ON umbrella_group_invitations
  FOR INSERT WITH CHECK (
    umbrella_group_id IN (
      SELECT umbrella_group_id FROM umbrella_group_memberships
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can update invitations sent to them" ON umbrella_group_invitations
  FOR UPDATE USING (
    email = (SELECT email FROM users WHERE id = auth.uid())
    OR umbrella_group_id IN (
      SELECT umbrella_group_id FROM umbrella_group_memberships
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Recipe Shares: Members can read, creators can manage
CREATE POLICY "Members can read shared recipes" ON recipe_umbrella_group_shares
  FOR SELECT USING (
    umbrella_group_id IN (
      SELECT umbrella_group_id FROM umbrella_group_memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can share their recipes" ON recipe_umbrella_group_shares
  FOR INSERT WITH CHECK (
    recipe_id IN (
      SELECT id FROM recipes WHERE created_by_user_id = auth.uid()
    )
    AND umbrella_group_id IN (
      SELECT umbrella_group_id FROM umbrella_group_memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can unshare their recipes" ON recipe_umbrella_group_shares
  FOR DELETE USING (
    recipe_id IN (
      SELECT id FROM recipes WHERE created_by_user_id = auth.uid()
    )
  );

-- Umbrella Group Ratings: Members can read and rate
CREATE POLICY "Members can read group ratings" ON umbrella_group_recipe_ratings
  FOR SELECT USING (
    umbrella_group_id IN (
      SELECT umbrella_group_id FROM umbrella_group_memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members can create ratings" ON umbrella_group_recipe_ratings
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND umbrella_group_id IN (
      SELECT umbrella_group_id FROM umbrella_group_memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own ratings" ON umbrella_group_recipe_ratings
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own ratings" ON umbrella_group_recipe_ratings
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- 13. HELPER FUNCTIONS
-- ============================================================================

-- Function to automatically create user record on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user record on auth signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to automatically add creator as admin when creating a group
CREATE OR REPLACE FUNCTION public.add_creator_as_admin()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.umbrella_group_memberships (umbrella_group_id, user_id, role)
  VALUES (NEW.id, NEW.created_by_user_id, 'admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to add creator as admin
CREATE TRIGGER on_umbrella_group_created
  AFTER INSERT ON umbrella_groups
  FOR EACH ROW EXECUTE FUNCTION public.add_creator_as_admin();
