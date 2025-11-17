# Getting Started with Family Meal Planner

Welcome! This guide will help you get your Family Meal Planner app up and running.

## What's Been Built So Far

I've set up the foundation of your meal planning application with the following features:

### ✅ Core Infrastructure
- **Next.js 16** with TypeScript and Tailwind CSS
- **Supabase** integration for database and authentication
- **Mobile-first responsive design** with bottom navigation
- **Database schema** for all planned features

### ✅ Database Tables
- `families` - Family profile and budget
- `family_members` - Individual members with dietary preferences
- `recipes` - Recipe storage with ratings, cost tracking, complexity
- `recipe_ratings` - Individual ratings from family members
- `inventory_items` - Kitchen inventory tracking
- `meal_plans` - Weekly meal calendar
- `grocery_list_items` - Shopping list generation
- `seasonal_produce` - Pre-populated seasonal produce database (60+ items!)

### ✅ Authentication
- Sign up with family profile creation
- Login/logout functionality
- Protected dashboard routes

### ✅ Recipe Import
- Recipe scraper for **Mel's Kitchen Cafe**
- Recipe scraper for **Tastes Better From Scratch**
- Generic JSON-LD parser for other recipe sites
- Automatic extraction of ingredients, instructions, times, servings

### ✅ Dashboard
- Quick stats overview
- Upcoming meals display
- Items expiring soon alerts
- Quick action buttons

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

Follow the detailed guide in [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)

**Quick version:**
1. Create a project at [supabase.com](https://supabase.com)
2. Copy your project URL and anon key
3. Update `.env.local` with your credentials
4. Run the SQL migrations in the Supabase SQL Editor

### 3. Start Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### 4. Create Your Account

1. Click "Create Family Account"
2. Enter your family name, email, password, and monthly budget
3. Sign in and start exploring!

## What to Build Next

Here are the remaining features to complete your V1 MVP:

### High Priority (Core V1 Features)

1. **Recipe Browser** ([app/dashboard/recipes/page.tsx](app/dashboard/recipes/page.tsx))
   - Display all recipes in a grid/list
   - Filter by: cost bucket, complexity, tags, seasonal
   - Sort by: name, last made date, rating
   - Search functionality

2. **Recipe Detail Page** ([app/dashboard/recipes/[id]/page.tsx](app/dashboard/recipes/[id]/page.tsx))
   - View full recipe details
   - Display family member ratings
   - Edit recipe
   - Delete recipe
   - "Add to meal plan" button

3. **Recipe Import Page** ([app/dashboard/recipes/import/page.tsx](app/dashboard/recipes/import/page.tsx))
   - Form to paste URL
   - Preview scraped recipe
   - Edit before saving
   - Set complexity, cost bucket, tags

4. **Family Setup Page** ([app/dashboard/setup/page.tsx](app/dashboard/setup/page.tsx))
   - Add family members (names, dietary restrictions, preferences)
   - Edit family profile
   - Update monthly budget

5. **Meal Planning Calendar** ([app/dashboard/calendar/page.tsx](app/dashboard/calendar/page.tsx))
   - Week view (Mon-Sun)
   - Assign recipes to days
   - Smart suggestions based on:
     - Last made date
     - Expiring inventory
     - Seasonal produce
     - Cost budget
     - Complexity balance
   - Drag and drop interface

6. **Inventory Management** ([app/dashboard/inventory/page.tsx](app/dashboard/inventory/page.tsx))
   - List all inventory items
   - Add new items (name, category, quantity, expiration)
   - Edit/delete items
   - Visual indicators for expiring items
   - Group by category

7. **Grocery List** ([app/dashboard/shopping/page.tsx](app/dashboard/shopping/page.tsx))
   - Generate list from week's meal plan
   - Check against inventory
   - Manual add/remove items
   - Group by category
   - Check off items
   - Clear completed items

### Medium Priority (Enhanced Features)

8. **Recipe Form** (Manual recipe entry)
   - For when you can't import from URL
   - All recipe fields
   - Photo upload

9. **Seasonal Produce Helper**
   - Utility to show what's in season now
   - Integration with recipe suggestions

10. **Budget Tracking Dashboard**
    - Week total cost
    - Month-to-date spending
    - Budget remaining visualization

### Lower Priority (Nice to Have)

11. **Recipe History View**
    - Calendar view of past meals
    - Frequency statistics

12. **Mobile PWA Features**
    - Offline support
    - Install prompt
    - Push notifications

## File Structure Reference

```
family-meal-planner/
├── app/
│   ├── auth/
│   │   ├── login/page.tsx          ✅ Done
│   │   └── signup/page.tsx         ✅ Done
│   ├── dashboard/
│   │   ├── layout.tsx              ✅ Done
│   │   ├── page.tsx                ✅ Done (Dashboard)
│   │   ├── setup/page.tsx          ⏳ TODO
│   │   ├── recipes/
│   │   │   ├── page.tsx            ⏳ TODO (Recipe browser)
│   │   │   ├── import/page.tsx     ⏳ TODO (Import form)
│   │   │   ├── new/page.tsx        ⏳ TODO (Manual entry)
│   │   │   └── [id]/page.tsx       ⏳ TODO (Recipe detail)
│   │   ├── calendar/page.tsx       ⏳ TODO (Meal planning)
│   │   ├── inventory/page.tsx      ⏳ TODO (Inventory)
│   │   └── shopping/page.tsx       ⏳ TODO (Shopping list)
│   ├── globals.css                 ✅ Done
│   ├── layout.tsx                  ✅ Done
│   └── page.tsx                    ✅ Done (Landing page)
├── components/
│   └── Navigation.tsx              ✅ Done
├── lib/
│   ├── supabase/
│   │   ├── client.ts               ✅ Done
│   │   ├── server.ts               ✅ Done
│   │   └── middleware.ts           ✅ Done
│   └── recipe-scraper.ts           ✅ Done
├── types/
│   └── database.types.ts           ✅ Done
├── supabase/
│   └── migrations/
│       ├── 20250116000000_initial_schema.sql       ✅ Done
│       └── 20250116000001_seed_seasonal_produce.sql ✅ Done
└── docs/
    ├── ARCHITECTURE.md             ✅ Done
    ├── DEPLOYMENT.md               ✅ Done
    └── SUPABASE_SETUP.md           ✅ Done
```

## Helpful Commands

```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run linter

# Git
git status           # Check changes
git add .            # Stage changes
git commit -m "..."  # Commit with message
git push             # Push to GitHub (auto-deploys to Vercel)
```

## Key Technologies

- **Next.js 16** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **Supabase** - PostgreSQL database + auth
- **Cheerio** - HTML parsing for recipe scraping

## Design Decisions

### User Flow
1. **Check inventory** → See what's expiring
2. **Browse recipes** → Filter/sort to find meals
3. **Plan week** → Assign recipes to calendar
4. **Generate list** → Auto-create shopping list
5. **Shop** → Use mobile app at store
6. **Cook & rate** → Track what family likes

### Data Model Highlights
- **One family per account** - Simple auth model
- **Multiple family members** - For individual ratings
- **Recipe ingredients as JSONB** - Flexible structure
- **Enum types** - Cost buckets, complexity, categories
- **Timestamps everywhere** - Track when things were created/updated

## Tips for Development

1. **Use the Supabase Table Editor** to manually add test data while building
2. **Test mobile view** - This is mobile-first! Use browser dev tools
3. **Check the database types** - TypeScript will help catch errors
4. **Reference the schema** - All tables and relationships are in the migration files
5. **Use the recipe scraper** - Test with real URLs from the supported sites

## Common Issues & Solutions

### Environment Variables Not Loading
- Make sure `.env.local` is in the root directory
- Restart the dev server after changing env vars
- Variables must start with `NEXT_PUBLIC_` to be accessible in client components

### Database Connection Errors
- Verify Supabase credentials in `.env.local`
- Check that migrations have been run
- Ensure RLS policies allow authenticated access

### Recipe Import Not Working
- Check that the URL is from a supported site
- Verify the site's HTML structure hasn't changed
- Look at browser console for error details

## Need Help?

- Check the [Supabase Setup Guide](docs/SUPABASE_SETUP.md)
- Review the [Architecture Documentation](docs/ARCHITECTURE.md)
- Look at existing code patterns in completed pages

## Next Session Goals

I recommend tackling these in order:

1. **Family Setup Page** - So you can add family members
2. **Recipe Import Page** - Start building your recipe collection
3. **Recipe Browser** - View and filter your recipes
4. **Recipe Detail Page** - See full recipe info and ratings
5. **Inventory Management** - Track what you have
6. **Meal Planning Calendar** - The core workflow!
7. **Shopping List** - Complete the loop

Each of these builds on the infrastructure that's already in place. The database, auth, and navigation are all ready to go!

## Questions to Consider

As you build, think about:
- How do you want to categorize recipes? (tags, cuisines, etc.)
- What makes a recipe "seasonal"? (based on ingredients)
- How should the week view look on mobile?
- Do you want notifications for expiring items?
- Should recipes suggest substitutions for inventory you have?

Happy coding! 🎉
