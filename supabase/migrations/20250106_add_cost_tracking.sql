-- Add cost tracking fields to recipes table
ALTER TABLE recipes
ADD COLUMN IF NOT EXISTS estimated_cost_usd DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS cost_per_serving_usd DECIMAL(10,2);

-- Create ingredient_prices table for tracking historical prices
CREATE TABLE IF NOT EXISTS ingredient_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,
  price_usd DECIMAL(10,2) NOT NULL,
  quantity TEXT, -- "1 lb", "dozen", "1 gal", etc.
  store_name TEXT,
  purchase_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ingredient_prices_family_id ON ingredient_prices(family_id);
CREATE INDEX IF NOT EXISTS idx_ingredient_prices_ingredient_name ON ingredient_prices(ingredient_name);
CREATE INDEX IF NOT EXISTS idx_ingredient_prices_purchase_date ON ingredient_prices(purchase_date DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE ingredient_prices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ingredient_prices
CREATE POLICY "Users can view their family's ingredient prices"
  ON ingredient_prices FOR SELECT
  USING (
    family_id IN (
      SELECT id FROM families WHERE id IN (
        SELECT family_id FROM family_members WHERE family_id = (
          SELECT family_id FROM family_members WHERE family_id IN (
            SELECT id FROM families
          )
        )
      )
    )
  );

CREATE POLICY "Users can insert ingredient prices for their family"
  ON ingredient_prices FOR INSERT
  WITH CHECK (
    family_id IN (
      SELECT id FROM families WHERE id IN (
        SELECT family_id FROM family_members WHERE family_id = (
          SELECT family_id FROM family_members WHERE family_id IN (
            SELECT id FROM families
          )
        )
      )
    )
  );

CREATE POLICY "Users can update their family's ingredient prices"
  ON ingredient_prices FOR UPDATE
  USING (
    family_id IN (
      SELECT id FROM families WHERE id IN (
        SELECT family_id FROM family_members WHERE family_id = (
          SELECT family_id FROM family_members WHERE family_id IN (
            SELECT id FROM families
          )
        )
      )
    )
  );

CREATE POLICY "Users can delete their family's ingredient prices"
  ON ingredient_prices FOR DELETE
  USING (
    family_id IN (
      SELECT id FROM families WHERE id IN (
        SELECT family_id FROM family_members WHERE family_id = (
          SELECT family_id FROM family_members WHERE family_id IN (
            SELECT id FROM families
          )
        )
      )
    )
  );

-- Add comment
COMMENT ON TABLE ingredient_prices IS 'Tracks historical ingredient prices to estimate recipe costs';
