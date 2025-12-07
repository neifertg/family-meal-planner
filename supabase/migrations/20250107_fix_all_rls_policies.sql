-- CRITICAL SECURITY FIX: Properly restrict RLS policies to family-specific data
-- Current policies allow ALL authenticated users to see ALL data across all families
-- This migration fixes all broken RLS policies

-- Helper function to get user's family_id
CREATE OR REPLACE FUNCTION get_user_family_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT family_id
    FROM family_members
    WHERE user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FAMILIES TABLE - Already fixed in previous migration, skip
-- ============================================================================
-- No changes needed - already has proper RLS policies based on created_by

-- ============================================================================
-- FAMILY_MEMBERS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Allow all for authenticated users" ON family_members;

CREATE POLICY "Users can view their family members" ON family_members
  FOR SELECT USING (family_id = get_user_family_id());

CREATE POLICY "Users can insert family members to their family" ON family_members
  FOR INSERT WITH CHECK (family_id = get_user_family_id());

CREATE POLICY "Users can update their family members" ON family_members
  FOR UPDATE USING (family_id = get_user_family_id());

CREATE POLICY "Users can delete their family members" ON family_members
  FOR DELETE USING (family_id = get_user_family_id());

-- ============================================================================
-- INVENTORY_ITEMS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Allow all for authenticated users" ON inventory_items;

CREATE POLICY "Users can view their family's inventory" ON inventory_items
  FOR SELECT USING (family_id = get_user_family_id());

CREATE POLICY "Users can insert items to their family's inventory" ON inventory_items
  FOR INSERT WITH CHECK (family_id = get_user_family_id());

CREATE POLICY "Users can update their family's inventory" ON inventory_items
  FOR UPDATE USING (family_id = get_user_family_id());

CREATE POLICY "Users can delete from their family's inventory" ON inventory_items
  FOR DELETE USING (family_id = get_user_family_id());

-- ============================================================================
-- GROCERY_LIST_ITEMS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Allow all for authenticated users" ON grocery_list_items;

CREATE POLICY "Users can view their family's shopping list" ON grocery_list_items
  FOR SELECT USING (family_id = get_user_family_id());

CREATE POLICY "Users can insert to their family's shopping list" ON grocery_list_items
  FOR INSERT WITH CHECK (family_id = get_user_family_id());

CREATE POLICY "Users can update their family's shopping list" ON grocery_list_items
  FOR UPDATE USING (family_id = get_user_family_id());

CREATE POLICY "Users can delete from their family's shopping list" ON grocery_list_items
  FOR DELETE USING (family_id = get_user_family_id());

-- ============================================================================
-- MEAL_PLANS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Allow all for authenticated users" ON meal_plans;

CREATE POLICY "Users can view their family's meal plans" ON meal_plans
  FOR SELECT USING (family_id = get_user_family_id());

CREATE POLICY "Users can insert to their family's meal plans" ON meal_plans
  FOR INSERT WITH CHECK (family_id = get_user_family_id());

CREATE POLICY "Users can update their family's meal plans" ON meal_plans
  FOR UPDATE USING (family_id = get_user_family_id());

CREATE POLICY "Users can delete from their family's meal plans" ON meal_plans
  FOR DELETE USING (family_id = get_user_family_id());

-- ============================================================================
-- RECEIPT_SCANS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Allow all for authenticated users" ON receipt_scans;

CREATE POLICY "Users can view their family's receipts" ON receipt_scans
  FOR SELECT USING (family_id = get_user_family_id());

CREATE POLICY "Users can insert receipts for their family" ON receipt_scans
  FOR INSERT WITH CHECK (family_id = get_user_family_id());

CREATE POLICY "Users can update their family's receipts" ON receipt_scans
  FOR UPDATE USING (family_id = get_user_family_id());

CREATE POLICY "Users can delete their family's receipts" ON receipt_scans
  FOR DELETE USING (family_id = get_user_family_id());

-- ============================================================================
-- RECEIPT_ITEM_CORRECTIONS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Allow all for authenticated users" ON receipt_item_corrections;

CREATE POLICY "Users can view their family's receipt items" ON receipt_item_corrections
  FOR SELECT USING (family_id = get_user_family_id());

CREATE POLICY "Users can insert receipt items for their family" ON receipt_item_corrections
  FOR INSERT WITH CHECK (family_id = get_user_family_id());

CREATE POLICY "Users can update their family's receipt items" ON receipt_item_corrections
  FOR UPDATE USING (family_id = get_user_family_id());

CREATE POLICY "Users can delete their family's receipt items" ON receipt_item_corrections
  FOR DELETE USING (family_id = get_user_family_id());

-- ============================================================================
-- INGREDIENT_PRICES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Allow all for authenticated users" ON ingredient_prices;

CREATE POLICY "Users can view their family's ingredient prices" ON ingredient_prices
  FOR SELECT USING (family_id = get_user_family_id());

CREATE POLICY "Users can insert ingredient prices for their family" ON ingredient_prices
  FOR INSERT WITH CHECK (family_id = get_user_family_id());

CREATE POLICY "Users can update their family's ingredient prices" ON ingredient_prices
  FOR UPDATE USING (family_id = get_user_family_id());

CREATE POLICY "Users can delete their family's ingredient prices" ON ingredient_prices
  FOR DELETE USING (family_id = get_user_family_id());

-- ============================================================================
-- RECIPE_RATINGS TABLE (family-scoped, not global)
-- ============================================================================
DROP POLICY IF EXISTS "Allow all for authenticated users" ON recipe_ratings;

CREATE POLICY "Users can view their family's recipe ratings" ON recipe_ratings
  FOR SELECT USING (
    family_member_id IN (
      SELECT id FROM family_members WHERE family_id = get_user_family_id()
    )
  );

CREATE POLICY "Users can insert recipe ratings for their family" ON recipe_ratings
  FOR INSERT WITH CHECK (
    family_member_id IN (
      SELECT id FROM family_members WHERE family_id = get_user_family_id()
    )
  );

CREATE POLICY "Users can update their family's recipe ratings" ON recipe_ratings
  FOR UPDATE USING (
    family_member_id IN (
      SELECT id FROM family_members WHERE family_id = get_user_family_id()
    )
  );

CREATE POLICY "Users can delete their family's recipe ratings" ON recipe_ratings
  FOR DELETE USING (
    family_member_id IN (
      SELECT id FROM family_members WHERE family_id = get_user_family_id()
    )
  );

-- ============================================================================
-- RECIPES TABLE (remains global - already fixed in previous migration)
-- ============================================================================
-- No changes needed - recipes are intentionally global

-- Add comment explaining the security model
COMMENT ON FUNCTION get_user_family_id IS 'Returns the family_id for the currently authenticated user. Used by RLS policies to restrict data access to family members only.';
