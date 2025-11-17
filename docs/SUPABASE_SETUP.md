# Supabase Setup Guide

This guide will help you set up Supabase for the Family Meal Planner application.

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up or log in
2. Click "New Project"
3. Fill in your project details:
   - **Name**: Family Meal Planner
   - **Database Password**: (create a strong password and save it)
   - **Region**: Choose the region closest to you
4. Click "Create new project"
5. Wait for your project to be set up (takes about 2 minutes)

## Step 2: Get Your Project Credentials

1. Once your project is ready, go to **Settings** > **API**
2. Find and copy:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public** key (under "Project API keys")

## Step 3: Configure Environment Variables

1. Open the `.env.local` file in the root of your project
2. Replace the placeholder values with your actual credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## Step 4: Run Database Migrations

You have two options to set up your database schema:

### Option A: Using Supabase SQL Editor (Recommended for beginners)

1. Go to your Supabase project dashboard
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**
4. Open `supabase/migrations/20250116000000_initial_schema.sql` from this project
5. Copy and paste the entire contents into the SQL Editor
6. Click **Run** to execute the migration
7. Repeat steps 3-6 for `supabase/migrations/20250116000001_seed_seasonal_produce.sql`

### Option B: Using Supabase CLI (For developers familiar with CLI tools)

1. Install the Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Link your project:
   ```bash
   supabase link --project-ref your-project-ref
   ```
   (You can find your project ref in the Project Settings)

3. Run migrations:
   ```bash
   supabase db push
   ```

## Step 5: Set Up Authentication

1. In your Supabase dashboard, go to **Authentication** > **Providers**
2. Enable **Email** provider (it should be enabled by default)
3. Optionally configure email templates under **Authentication** > **Email Templates**

## Step 6: Verify Your Setup

Your database should now have the following tables:
- `families`
- `family_members`
- `recipes`
- `recipe_ratings`
- `inventory_items`
- `meal_plans`
- `grocery_list_items`
- `seasonal_produce`

You can verify this by:
1. Going to **Table Editor** in your Supabase dashboard
2. You should see all the tables listed in the left sidebar
3. The `seasonal_produce` table should already have data populated

## Step 7: Create Your First Family Account

Once the app is running, you'll be able to:
1. Sign up with an email and password
2. Create your family profile
3. Add family members
4. Start adding recipes and planning meals!

## Troubleshooting

### Connection Issues
- Make sure your `.env.local` file is in the root directory
- Verify that both environment variables are set correctly
- Restart your Next.js development server after changing environment variables

### Migration Errors
- Ensure you're running migrations in order (initial_schema first, then seed data)
- Check the SQL Editor for any error messages
- Make sure you have the UUID extension enabled (it's included in the migration)

### Row Level Security
- The migrations include basic RLS policies that allow all authenticated users to access data
- For production, you may want to implement more granular policies based on `family_id`

## Next Steps

After setting up Supabase:
1. Start the development server: `npm run dev`
2. Visit `http://localhost:3000`
3. Create your family account and start planning meals!

## Database Schema Overview

### Core Tables
- **families**: Stores family profile and monthly budget
- **family_members**: Individual family members with dietary preferences
- **recipes**: All your recipes with ingredients, instructions, cost, complexity
- **recipe_ratings**: Family member ratings for each recipe
- **inventory_items**: Current kitchen inventory with quantities and expiration dates
- **meal_plans**: Weekly meal planning assignments
- **grocery_list_items**: Shopping list items generated from meal plans
- **seasonal_produce**: Reference data for seasonal fruits, vegetables, and herbs
