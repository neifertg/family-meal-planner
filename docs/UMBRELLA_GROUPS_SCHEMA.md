# Umbrella Groups Schema Documentation

## Overview

The Umbrella Groups feature enables extended family recipe sharing across multiple family units. This allows users to belong to multiple "umbrella groups" (e.g., Smith Family, Johnson Family) and share recipes/ratings within those groups.

## Core Concepts

### **Users**
- Actual people with login accounts (linked to Supabase Auth)
- Can belong to multiple umbrella groups
- Can create and share recipes

### **Families** (Existing)
- Household units (e.g., you + spouse + kids)
- Manages inventory, meal plans, and budget
- Can belong to multiple umbrella groups

### **Umbrella Groups** (New)
- Extended family groups for recipe sharing
- Can be private (invite-only) or public
- Has admins and members

## Database Schema

### 1. `users`
Links Supabase auth to application users.

```sql
id                UUID (PK, references auth.users)
email             TEXT (unique)
display_name      TEXT
avatar_url        TEXT
created_at        TIMESTAMP
updated_at        TIMESTAMP
```

**Auto-created** when a user signs up via the `handle_new_user()` trigger.

### 2. `umbrella_groups`
Extended family groups for recipe sharing.

```sql
id                   UUID (PK)
name                 TEXT (e.g., "Smith Family")
description          TEXT
logo_url             TEXT
privacy_level        'private' | 'public'
created_by_user_id   UUID (FK → users)
created_at           TIMESTAMP
updated_at           TIMESTAMP
```

**Creator is automatically added as admin** via the `add_creator_as_admin()` trigger.

### 3. `umbrella_group_memberships`
Tracks which users belong to which umbrella groups.

```sql
id                   UUID (PK)
umbrella_group_id    UUID (FK → umbrella_groups)
user_id              UUID (FK → users)
role                 'admin' | 'member'
joined_at            TIMESTAMP
```

**Unique constraint**: (umbrella_group_id, user_id) - one membership per user per group

**Roles:**
- `admin`: Can invite/remove users, delete group, manage settings
- `member`: Standard access (view/add recipes, rate, comment)

### 4. `family_umbrella_groups`
Links household families to umbrella groups.

```sql
id                   UUID (PK)
family_id            UUID (FK → families)
umbrella_group_id    UUID (FK → umbrella_groups)
added_at             TIMESTAMP
```

**Example**: Your household family can belong to both "Smith Family" and "Johnson Family" umbrella groups.

### 5. `umbrella_group_invitations`
Tracks pending, accepted, and declined invitations.

```sql
id                   UUID (PK)
umbrella_group_id    UUID (FK → umbrella_groups)
invited_by_user_id   UUID (FK → users)
email                TEXT
status               'pending' | 'accepted' | 'declined' | 'expired'
invited_at           TIMESTAMP
expires_at           TIMESTAMP
responded_at         TIMESTAMP
```

**Workflow:**
1. Admin invites user by email
2. Invitation sent with expiration date
3. User accepts/declines
4. On accept, `umbrella_group_memberships` record created

### 6. `recipes` (Updated)
Added creator tracking and group ownership.

```sql
-- New columns:
created_by_user_id   UUID (FK → users)
is_group_owned       BOOLEAN
```

**Ownership models:**
- **Personal recipe**: `is_group_owned = false`, owned by `created_by_user_id`
- **Group recipe**: `is_group_owned = true`, belongs to the group(s) it's shared with

### 7. `recipe_umbrella_group_shares`
Tracks which recipes are shared with which umbrella groups.

```sql
id                   UUID (PK)
recipe_id            UUID (FK → recipes)
umbrella_group_id    UUID (FK → umbrella_groups)
shared_by_user_id    UUID (FK → users)
shared_at            TIMESTAMP
```

**Unique constraint**: (recipe_id, umbrella_group_id) - recipe shared once per group

**Use cases:**
- Share personal recipe with multiple groups
- Share group recipe from one group to another

### 8. `umbrella_group_recipe_ratings`
Group-specific recipe ratings (separate from global `recipe_ratings`).

```sql
id                   UUID (PK)
recipe_id            UUID (FK → recipes)
umbrella_group_id    UUID (FK → umbrella_groups)
user_id              UUID (FK → users)
rating               INTEGER (1-5)
comment              TEXT
created_at           TIMESTAMP
updated_at           TIMESTAMP
```

**Unique constraint**: (recipe_id, umbrella_group_id, user_id) - one rating per user per recipe per group

**Rating aggregation:**
- **Per-group average**: `AVG(rating) WHERE umbrella_group_id = X`
- **Global average**: `AVG(rating)` across all groups
- **UI displays both**: "4.5 stars in Smith Family (4.2 overall)"

## Security (Row Level Security)

### Users
- ✅ Can read own profile
- ✅ Can update own profile
- ❌ Cannot read other users (unless in same group)

### Umbrella Groups
- ✅ Members can read their groups
- ✅ Public groups readable by all
- ✅ Users can create new groups (become admin)
- ✅ Admins can update/delete their groups
- ❌ Non-members cannot access private groups

### Memberships
- ✅ Members can read group membership list
- ✅ Admins can add/remove members
- ✅ Admins can change member roles
- ❌ Regular members cannot modify memberships

### Invitations
- ✅ Admins can create invitations
- ✅ Invitees can view invitations sent to their email
- ✅ Invitees can accept/decline
- ❌ Non-admins cannot invite

### Recipe Shares
- ✅ Members can view shared recipes in their groups
- ✅ Recipe creators can share to groups they belong to
- ✅ Recipe creators can unshare their recipes
- ❌ Cannot share others' personal recipes

### Ratings
- ✅ Members can read group ratings
- ✅ Members can rate recipes in their groups
- ✅ Users can update/delete their own ratings
- ❌ Cannot modify others' ratings

## Common Queries

### Get user's umbrella groups
```sql
SELECT g.*
FROM umbrella_groups g
JOIN umbrella_group_memberships m ON m.umbrella_group_id = g.id
WHERE m.user_id = $user_id;
```

### Get recipes shared with a group
```sql
SELECT r.*
FROM recipes r
JOIN recipe_umbrella_group_shares s ON s.recipe_id = r.id
WHERE s.umbrella_group_id = $group_id;
```

### Get group-specific rating average
```sql
SELECT
  recipe_id,
  AVG(rating)::DECIMAL(3,2) as avg_rating,
  COUNT(*) as rating_count
FROM umbrella_group_recipe_ratings
WHERE umbrella_group_id = $group_id
GROUP BY recipe_id;
```

### Get recipes across all user's groups ("All Groups" view)
```sql
SELECT DISTINCT r.*
FROM recipes r
JOIN recipe_umbrella_group_shares s ON s.recipe_id = r.id
JOIN umbrella_group_memberships m ON m.umbrella_group_id = s.umbrella_group_id
WHERE m.user_id = $user_id;
```

## Migration Notes

### Existing Data
- Existing `recipes` will have `NULL` for `created_by_user_id` (needs backfill)
- Existing `families` continue to work unchanged
- Existing `recipe_ratings` remain global (not group-specific)

### Recommended Migration Steps
1. Run the migration: `supabase db reset` or apply migration
2. Backfill `users` table from existing auth users
3. Optionally link existing `family_members` to `users` via auth
4. Create initial umbrella groups for existing families
5. Backfill `created_by_user_id` for existing recipes

## Next Steps

### Application Features to Build
1. **Group Management UI**
   - Create umbrella group
   - Invite members
   - Switch between groups
   - View group members

2. **Recipe Sharing UI**
   - Share recipe to group(s)
   - View which groups a recipe is shared with
   - Unshare from group

3. **Group Selector**
   - Dropdown/tabs in navigation
   - Filter recipes by selected group
   - "All Groups" view

4. **Ratings UI**
   - Show per-group ratings
   - Show global average
   - Allow rating within group context

## Example Use Case

**Seth's Setup:**
- **User**: Seth (seth@example.com)
- **Family**: Neifert Household (Seth + Wife + Kids)
- **Umbrella Groups**:
  - "Neifert Family" (Seth's side)
  - "Smith Family" (Wife's side)

**Workflow:**
1. Seth creates "Grandma's Lasagna" recipe
2. Seth shares it with "Neifert Family" group
3. Seth's cousin rates it 5 stars in "Neifert Family" context
4. Seth also shares it with "Smith Family" group
5. Wife's mom rates it 4 stars in "Smith Family" context
6. Recipe shows: "4.5 overall (5★ in Neifert Family, 4★ in Smith Family)"

## Support

For questions or issues with the umbrella groups feature, please refer to:
- Database migration: `supabase/migrations/20250117000000_umbrella_groups.sql`
- This documentation: `docs/UMBRELLA_GROUPS_SCHEMA.md`
