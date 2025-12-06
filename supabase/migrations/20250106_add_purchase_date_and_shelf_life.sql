-- Add purchase_date to inventory_items table
ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS purchase_date DATE;

-- Create ingredient_shelf_life lookup table
CREATE TABLE IF NOT EXISTS ingredient_shelf_life (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ingredient_pattern TEXT NOT NULL UNIQUE, -- Pattern to match ingredient names (e.g., "milk", "chicken")
  shelf_life_days INTEGER NOT NULL, -- How many days the ingredient lasts
  storage_type TEXT, -- refrigerated, frozen, pantry
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert common grocery items with typical shelf life
INSERT INTO ingredient_shelf_life (ingredient_pattern, shelf_life_days, storage_type, notes) VALUES
  -- Dairy
  ('milk', 7, 'refrigerated', 'Unopened milk lasts about 7 days past purchase'),
  ('yogurt', 14, 'refrigerated', 'Greek yogurt and regular yogurt'),
  ('cheese', 21, 'refrigerated', 'Hard cheeses last longer, soft cheeses shorter'),
  ('butter', 30, 'refrigerated', 'Can last up to 2 months frozen'),
  ('cream', 7, 'refrigerated', 'Heavy cream and half-and-half'),
  ('sour cream', 14, 'refrigerated', 'Lasts about 2 weeks refrigerated'),

  -- Eggs
  ('egg', 28, 'refrigerated', 'Eggs last 3-5 weeks in refrigerator'),

  -- Meat & Poultry
  ('chicken', 2, 'refrigerated', 'Raw chicken lasts 1-2 days refrigerated, 9 months frozen'),
  ('beef', 3, 'refrigerated', 'Raw beef lasts 3-5 days refrigerated'),
  ('pork', 3, 'refrigerated', 'Raw pork lasts 3-5 days refrigerated'),
  ('ground beef', 2, 'refrigerated', 'Ground meat spoils faster'),
  ('ground turkey', 2, 'refrigerated', 'Ground poultry spoils quickly'),
  ('bacon', 7, 'refrigerated', 'Unopened bacon lasts 1-2 weeks'),
  ('sausage', 7, 'refrigerated', 'Fresh sausage lasts about 1 week'),
  ('turkey', 2, 'refrigerated', 'Fresh turkey parts'),
  ('lamb', 3, 'refrigerated', 'Raw lamb lasts 3-5 days'),

  -- Seafood
  ('fish', 2, 'refrigerated', 'Fresh fish lasts 1-2 days refrigerated'),
  ('salmon', 2, 'refrigerated', 'Fresh salmon lasts 1-2 days'),
  ('shrimp', 2, 'refrigerated', 'Fresh shrimp lasts 1-2 days'),
  ('tuna', 2, 'refrigerated', 'Fresh tuna steaks'),

  -- Produce - Fruits
  ('apple', 30, 'refrigerated', 'Apples last 4-6 weeks in refrigerator'),
  ('banana', 5, 'pantry', 'Bananas ripen quickly at room temperature'),
  ('orange', 14, 'refrigerated', 'Oranges last 2-3 weeks refrigerated'),
  ('grape', 7, 'refrigerated', 'Grapes last about 1 week'),
  ('strawberry', 5, 'refrigerated', 'Berries spoil quickly'),
  ('blueberry', 7, 'refrigerated', 'Blueberries last about 1 week'),
  ('raspberry', 3, 'refrigerated', 'Raspberries are very delicate'),
  ('blackberry', 3, 'refrigerated', 'Blackberries spoil quickly'),
  ('lemon', 21, 'refrigerated', 'Lemons last 2-4 weeks'),
  ('lime', 14, 'refrigerated', 'Limes last 2-3 weeks'),
  ('avocado', 5, 'pantry', 'Ripe avocados last 3-5 days'),
  ('tomato', 7, 'pantry', 'Store at room temperature until ripe'),
  ('peach', 5, 'refrigerated', 'Ripe peaches last 3-5 days refrigerated'),
  ('pear', 7, 'refrigerated', 'Ripe pears last about 1 week'),
  ('watermelon', 7, 'refrigerated', 'Whole watermelon lasts 7-10 days'),

  -- Produce - Vegetables
  ('lettuce', 7, 'refrigerated', 'Lettuce lasts about 1 week'),
  ('spinach', 5, 'refrigerated', 'Fresh spinach lasts 3-7 days'),
  ('kale', 7, 'refrigerated', 'Kale lasts about 1 week'),
  ('broccoli', 7, 'refrigerated', 'Broccoli lasts 7-14 days'),
  ('cauliflower', 7, 'refrigerated', 'Cauliflower lasts 7-10 days'),
  ('carrot', 21, 'refrigerated', 'Carrots last 3-4 weeks'),
  ('celery', 14, 'refrigerated', 'Celery lasts 2-4 weeks'),
  ('cucumber', 7, 'refrigerated', 'Cucumbers last about 1 week'),
  ('bell pepper', 7, 'refrigerated', 'Peppers last 1-2 weeks'),
  ('pepper', 7, 'refrigerated', 'Fresh peppers'),
  ('onion', 30, 'pantry', 'Whole onions last 1-2 months in cool, dry place'),
  ('garlic', 90, 'pantry', 'Whole garlic bulbs last 3-6 months'),
  ('potato', 60, 'pantry', 'Store in cool, dark, dry place'),
  ('sweet potato', 30, 'pantry', 'Store in cool, dry place'),
  ('mushroom', 7, 'refrigerated', 'Mushrooms last 4-7 days'),
  ('zucchini', 7, 'refrigerated', 'Zucchini lasts 4-7 days'),
  ('squash', 7, 'refrigerated', 'Summer squash lasts about 1 week'),
  ('corn', 3, 'refrigerated', 'Fresh corn lasts 1-3 days'),
  ('green bean', 5, 'refrigerated', 'Fresh green beans last 3-5 days'),

  -- Bread & Bakery
  ('bread', 5, 'pantry', 'Store-bought bread lasts 5-7 days'),
  ('bagel', 5, 'pantry', 'Bagels last about 5 days'),
  ('tortilla', 7, 'refrigerated', 'Tortillas last 1-2 weeks refrigerated'),

  -- Pantry Staples (long shelf life)
  ('rice', 730, 'pantry', 'Uncooked white rice lasts 2+ years'),
  ('pasta', 730, 'pantry', 'Dried pasta lasts 2+ years'),
  ('flour', 180, 'pantry', 'All-purpose flour lasts 6-8 months'),
  ('sugar', 730, 'pantry', 'Sugar lasts indefinitely if stored properly'),
  ('oil', 180, 'pantry', 'Vegetable oil lasts 6-12 months'),
  ('olive oil', 180, 'pantry', 'Olive oil lasts 6-12 months'),
  ('honey', 3650, 'pantry', 'Honey never spoils'),
  ('salt', 3650, 'pantry', 'Salt never spoils'),
  ('beans', 730, 'pantry', 'Dried beans last 2-3 years'),
  ('lentil', 730, 'pantry', 'Dried lentils last 2-3 years'),

  -- Condiments & Sauces (unopened)
  ('ketchup', 365, 'pantry', 'Unopened ketchup lasts 1+ years'),
  ('mustard', 365, 'pantry', 'Unopened mustard lasts 1+ years'),
  ('mayonnaise', 90, 'pantry', 'Unopened mayo lasts 3-4 months'),
  ('soy sauce', 730, 'pantry', 'Soy sauce lasts 2-3 years'),
  ('hot sauce', 365, 'pantry', 'Hot sauce lasts 1+ years'),
  ('salsa', 30, 'refrigerated', 'Fresh salsa lasts 1-2 weeks refrigerated'),

  -- Frozen Foods
  ('frozen', 90, 'frozen', 'Most frozen foods last 3-6 months'),
  ('ice cream', 60, 'frozen', 'Ice cream lasts about 2 months')
ON CONFLICT (ingredient_pattern) DO NOTHING;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ingredient_shelf_life_pattern ON ingredient_shelf_life(ingredient_pattern);

-- Add RLS policies
ALTER TABLE ingredient_shelf_life ENABLE ROW LEVEL SECURITY;

-- Everyone can read shelf life data
CREATE POLICY "ingredient_shelf_life_select" ON ingredient_shelf_life
  FOR SELECT USING (true);
