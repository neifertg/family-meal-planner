-- Seed seasonal produce data
-- Months are represented as integers: 1=Jan, 2=Feb, ..., 12=Dec

-- Fruits
INSERT INTO seasonal_produce (name, category, months) VALUES
  ('Apples', 'fruit', ARRAY[9, 10, 11, 12, 1, 2]),
  ('Apricots', 'fruit', ARRAY[6, 7, 8]),
  ('Blackberries', 'fruit', ARRAY[7, 8, 9]),
  ('Blueberries', 'fruit', ARRAY[6, 7, 8, 9]),
  ('Cherries', 'fruit', ARRAY[6, 7]),
  ('Cranberries', 'fruit', ARRAY[10, 11, 12]),
  ('Figs', 'fruit', ARRAY[8, 9, 10]),
  ('Grapefruit', 'fruit', ARRAY[12, 1, 2, 3, 4]),
  ('Grapes', 'fruit', ARRAY[8, 9, 10, 11]),
  ('Melons', 'fruit', ARRAY[6, 7, 8, 9]),
  ('Oranges', 'fruit', ARRAY[12, 1, 2, 3, 4]),
  ('Peaches', 'fruit', ARRAY[6, 7, 8, 9]),
  ('Pears', 'fruit', ARRAY[8, 9, 10, 11, 12]),
  ('Plums', 'fruit', ARRAY[7, 8, 9]),
  ('Raspberries', 'fruit', ARRAY[6, 7, 8, 9]),
  ('Strawberries', 'fruit', ARRAY[4, 5, 6, 7]),
  ('Watermelon', 'fruit', ARRAY[6, 7, 8, 9]);

-- Vegetables
INSERT INTO seasonal_produce (name, category, months) VALUES
  ('Artichokes', 'vegetable', ARRAY[3, 4, 5]),
  ('Arugula', 'vegetable', ARRAY[3, 4, 5, 9, 10, 11]),
  ('Asparagus', 'vegetable', ARRAY[3, 4, 5, 6]),
  ('Beets', 'vegetable', ARRAY[6, 7, 8, 9, 10, 11]),
  ('Bell Peppers', 'vegetable', ARRAY[7, 8, 9, 10]),
  ('Broccoli', 'vegetable', ARRAY[10, 11, 12, 1, 2, 3]),
  ('Brussels Sprouts', 'vegetable', ARRAY[9, 10, 11, 12, 1, 2]),
  ('Cabbage', 'vegetable', ARRAY[10, 11, 12, 1, 2, 3]),
  ('Carrots', 'vegetable', ARRAY[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
  ('Cauliflower', 'vegetable', ARRAY[9, 10, 11, 12, 1, 2]),
  ('Celery', 'vegetable', ARRAY[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
  ('Corn', 'vegetable', ARRAY[7, 8, 9]),
  ('Cucumbers', 'vegetable', ARRAY[6, 7, 8, 9]),
  ('Eggplant', 'vegetable', ARRAY[7, 8, 9, 10]),
  ('Green Beans', 'vegetable', ARRAY[6, 7, 8, 9, 10]),
  ('Kale', 'vegetable', ARRAY[10, 11, 12, 1, 2, 3]),
  ('Leeks', 'vegetable', ARRAY[10, 11, 12, 1, 2, 3, 4]),
  ('Lettuce', 'vegetable', ARRAY[4, 5, 6, 7, 8, 9]),
  ('Mushrooms', 'vegetable', ARRAY[9, 10, 11, 12, 1]),
  ('Onions', 'vegetable', ARRAY[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
  ('Peas', 'vegetable', ARRAY[4, 5, 6, 7]),
  ('Potatoes', 'vegetable', ARRAY[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
  ('Pumpkin', 'vegetable', ARRAY[9, 10, 11, 12]),
  ('Radishes', 'vegetable', ARRAY[4, 5, 6, 7]),
  ('Spinach', 'vegetable', ARRAY[3, 4, 5, 9, 10, 11]),
  ('Squash (Summer)', 'vegetable', ARRAY[6, 7, 8, 9]),
  ('Squash (Winter)', 'vegetable', ARRAY[10, 11, 12, 1, 2]),
  ('Sweet Potatoes', 'vegetable', ARRAY[9, 10, 11, 12, 1]),
  ('Swiss Chard', 'vegetable', ARRAY[6, 7, 8, 9, 10]),
  ('Tomatoes', 'vegetable', ARRAY[6, 7, 8, 9, 10]),
  ('Turnips', 'vegetable', ARRAY[10, 11, 12, 1, 2, 3]),
  ('Zucchini', 'vegetable', ARRAY[6, 7, 8, 9]);

-- Herbs
INSERT INTO seasonal_produce (name, category, months) VALUES
  ('Basil', 'herb', ARRAY[6, 7, 8, 9]),
  ('Cilantro', 'herb', ARRAY[4, 5, 6, 9, 10]),
  ('Dill', 'herb', ARRAY[6, 7, 8]),
  ('Mint', 'herb', ARRAY[6, 7, 8, 9]),
  ('Oregano', 'herb', ARRAY[6, 7, 8]),
  ('Parsley', 'herb', ARRAY[4, 5, 6, 7, 8, 9]),
  ('Rosemary', 'herb', ARRAY[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
  ('Sage', 'herb', ARRAY[6, 7, 8, 9]),
  ('Thyme', 'herb', ARRAY[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
