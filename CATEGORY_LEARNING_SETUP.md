# Category Learning System Setup

## Overview

The shopping list now includes a **learning system** that remembers your category preferences for ingredients. When you change an ingredient's category, the app learns and will automatically use that category in future shopping lists.

## Features

1. **Edit Categories**: Click the edit button on any shopping list item to change its category
2. **Smart Categorization**: The app learns from your changes and applies them automatically
3. **Per-Family Learning**: Each family has their own learned preferences
4. **Persistent Memory**: Preferences are saved in the database and persist across sessions

## Database Setup

You need to create a new table in Supabase to store the learned category preferences.

### SQL Migration

Run this SQL in your Supabase SQL Editor:

```sql
-- Create table for storing learned ingredient category preferences
CREATE TABLE IF NOT EXISTS ingredient_category_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('produce', 'dairy', 'meat', 'frozen', 'pantry', 'other')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure one preference per ingredient per family
  UNIQUE(family_id, ingredient_name)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ingredient_category_prefs_family
  ON ingredient_category_preferences(family_id);

-- Create index for ingredient name lookups
CREATE INDEX IF NOT EXISTS idx_ingredient_category_prefs_name
  ON ingredient_category_preferences(ingredient_name);

-- Enable Row Level Security
ALTER TABLE ingredient_category_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see preferences for their own family
CREATE POLICY "Users can view their family's category preferences"
  ON ingredient_category_preferences
  FOR SELECT
  USING (
    family_id IN (
      SELECT family_id FROM family_members
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can insert preferences for their own family
CREATE POLICY "Users can insert category preferences for their family"
  ON ingredient_category_preferences
  FOR INSERT
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM family_members
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can update their family's preferences
CREATE POLICY "Users can update their family's category preferences"
  ON ingredient_category_preferences
  FOR UPDATE
  USING (
    family_id IN (
      SELECT family_id FROM family_members
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can delete their family's preferences
CREATE POLICY "Users can delete their family's category preferences"
  ON ingredient_category_preferences
  FOR DELETE
  USING (
    family_id IN (
      SELECT family_id FROM family_members
      WHERE user_id = auth.uid()
    )
  );

-- Add comment
COMMENT ON TABLE ingredient_category_preferences IS 'Stores user-learned category preferences for ingredients to improve automatic categorization';
```

### Verification

After running the migration, verify the table was created:

```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ingredient_category_preferences'
ORDER BY ordinal_position;
```

You should see:
- id (uuid)
- family_id (uuid)
- ingredient_name (text)
- category (text)
- updated_at (timestamptz)

## How It Works

### 1. User Changes Category

When you edit a shopping list item and change its category:
1. The item is updated with the new category
2. The app saves this as a learned preference: `ingredient_name → category`
3. Example: "salmon" → "meat"

### 2. Future Categorization

When generating a new shopping list:
1. App loads all your learned preferences from the database
2. For each ingredient, it checks learned preferences FIRST
3. If no learned preference exists, falls back to built-in pattern matching
4. Example: "salmon" will always be categorized as "meat" from now on

### 3. Learning Process

```
User Action:
  Edit "salmon" → Change category to "meat/protein" → Save

Database:
  INSERT INTO ingredient_category_preferences
  (family_id, ingredient_name, category)
  VALUES ('your-family-id', 'salmon', 'meat')

Next Shopping List:
  "salmon" → Check preferences → Found "meat" → Use "meat" category ✓
```

## Available Categories

- 🥬 **Produce**: Fruits, vegetables, fresh herbs
- 🥛 **Dairy**: Milk, cheese, yogurt, eggs
- 🥩 **Meat/Protein**: Chicken, beef, fish, seafood
- ❄️ **Frozen**: Frozen foods, ice cream
- 🥫 **Pantry**: Canned goods, spices, oils, grains
- 📦 **Other**: Everything else

## Usage Example

### Before Learning:
```
Shopping List generated:
- Salmon → "other" category (not recognized)
```

### User Teaches:
```
1. Click Edit on "salmon"
2. Change category dropdown to "🥩 Meat/Protein"
3. Click Save ✓
```

### After Learning:
```
Next Shopping List generated:
- Salmon → "meat" category (learned!) ✓
- Grilled Salmon → "meat" category (learned!) ✓
- Salmon fillet → "meat" category (learned!) ✓
```

The app remembers "salmon" = "meat" and applies it automatically!

## Technical Details

### Data Storage

**Table**: `ingredient_category_preferences`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| family_id | UUID | Which family owns this preference |
| ingredient_name | TEXT | Lowercase ingredient name |
| category | TEXT | Chosen category (produce/dairy/meat/frozen/pantry/other) |
| updated_at | TIMESTAMPTZ | When preference was last updated |

**Constraints**:
- One preference per ingredient per family (UNIQUE constraint)
- Category must be one of the 6 valid values (CHECK constraint)
- Family must exist (FOREIGN KEY)

### Performance

- **Indexes**: Created on `family_id` and `ingredient_name` for fast lookups
- **In-Memory Cache**: Preferences loaded once per shopping list generation
- **Upsert**: Uses `upsert` with `onConflict` to update existing preferences

### Privacy

- **Row Level Security (RLS)**: Enabled on the table
- **Family Isolation**: Users can only see/edit their own family's preferences
- **Auth Integration**: Uses Supabase auth.uid() for user verification

## Benefits

1. **Personalized**: Your family's preferences, not generic defaults
2. **Learns Over Time**: Gets better the more you use it
3. **Saves Time**: No need to recategorize the same ingredients repeatedly
4. **Consistent**: Same ingredient always goes to same category
5. **Shareable**: All family members benefit from learned preferences

## Migration Checklist

- [ ] Run SQL migration in Supabase SQL Editor
- [ ] Verify table created successfully
- [ ] Verify RLS policies are active
- [ ] Test: Edit a shopping list item's category
- [ ] Test: Generate new shopping list
- [ ] Verify: Item uses learned category

---

**Status**: Ready to deploy
**Breaking Changes**: None - backward compatible
**Supabase Action Required**: Yes - run SQL migration
