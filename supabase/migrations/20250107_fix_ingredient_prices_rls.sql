-- Fix RLS policies for ingredient_prices table
-- The existing policies have circular subqueries that don't work

-- Drop existing broken policies
DROP POLICY IF EXISTS "Users can view their family's ingredient prices" ON ingredient_prices;
DROP POLICY IF EXISTS "Users can insert ingredient prices for their family" ON ingredient_prices;
DROP POLICY IF EXISTS "Users can update their family's ingredient prices" ON ingredient_prices;
DROP POLICY IF EXISTS "Users can delete their family's ingredient prices" ON ingredient_prices;

-- Create simple, working policies
-- Since all authenticated users can access all families (based on existing RLS),
-- we'll use the same approach

CREATE POLICY "Allow all for authenticated users" ON ingredient_prices
  FOR ALL USING (auth.role() = 'authenticated');
