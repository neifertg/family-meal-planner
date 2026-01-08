# Shopping List Scaling Debug Guide

## Issue: Ingredients showing as 0.1 or very small quantities

### Likely Cause

The recipe scaling system is working correctly, but the recipe's **servings** field is set much higher than your family member count, causing ingredients to scale down.

**Formula:**
```
Scale Factor = (Family Members + Guests) / Recipe Servings
Scaled Quantity = Original Quantity × Scale Factor
```

**Example:**
- Recipe servings: 10
- Family members: 1
- Guests: 0
- Scale factor: 1/10 = 0.1
- "1 bell pepper" × 0.1 = "0.1 bell pepper" ❌

### How to Fix

#### Option 1: Update Recipe Servings (Recommended)

1. Go to the recipe detail page
2. Click "Edit Recipe"
3. Update the "Servings" field to the actual number the recipe serves
   - If the recipe serves 4 people, set servings to 4
   - If you're unsure, set it to match your family size
4. Save the recipe
5. Regenerate your shopping list

#### Option 2: Add More Family Members

1. Go to Account Settings
2. Add family members to match the recipe servings
3. Regenerate your shopping list

#### Option 3: Adjust Guest Count

When planning meals, set the guest count to make up the difference:
- Recipe serves: 10
- Family members: 2
- Set guests: 8
- Total: 10 (no scaling needed)

### Diagnostic Steps

**Check Recipe Servings:**
1. Open the recipe in your recipes list
2. Look at the "Servings" field
3. Does it match how many people the recipe actually serves?

**Check Family Members:**
1. Go to Account Settings → Family
2. Count active family members
3. This is the number used for scaling calculations

**Check Scaling Console Logs:**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Click "Generate from Meal Plan"
4. Look for messages like: `Scaling recipe "Recipe Name": 10 servings -> 1 servings`

### Common Scenarios

**Scenario 1: Recipe imported with wrong servings**
- Some recipe imports default to 10 or 12 servings
- Fix: Edit recipe and set correct servings (usually 4-6)

**Scenario 2: Single user account**
- You only have 1 family member configured
- All recipes scale down to 1/10th if they serve 10
- Fix: Either add family members or edit recipe servings

**Scenario 3: Batch cooking recipes**
- Recipe intentionally makes 10+ servings for meal prep
- You want to keep it that way
- Fix: When generating shopping list, expect larger quantities
- OR: Set guest count high when planning the meal

### Verifying the Fix

After updating recipe servings:
1. Clear shopping list items
2. Regenerate from meal plan
3. Check that quantities are now reasonable:
   - "1 bell pepper" not "0.1 bell pepper" ✓
   - "2 cups flour" not "0.2 cups flour" ✓

### Technical Details

**Where Scaling Happens:**
- File: `app/dashboard/shopping/page.tsx`
- Function: `generateFromMealPlan()`
- Lines: 256-259

```typescript
const targetServings = calculateTargetServings(familyMemberCount, plan.guest_count || 0)
const baseServings = recipe.servings || targetServings
const scaledIngredient = scaleIngredient(ingredient, baseServings, targetServings)
```

**Scaling Logic:**
- File: `lib/recipeScaling.ts`
- Function: `scaleIngredient()`
- If `baseServings === targetServings`, no scaling occurs
- Otherwise: `scaleFactor = targetServings / baseServings`

### Prevention

**When Adding New Recipes:**
1. Always verify the "Servings" field is correct
2. Default should match typical family size (4-6)
3. For meal prep/batch recipes, set accurately (10-12)

**When Importing Recipes:**
1. Check imported servings value immediately
2. Many sites use inflated serving counts
3. Adjust before adding to meal plans

---

**Still seeing issues?**

Check the browser console when generating the shopping list. You should see logs like:
```
Scaling recipe "Recipe Name": 10 servings -> 2 servings
```

This tells you exactly what scaling is happening.
