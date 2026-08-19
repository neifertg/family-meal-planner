-- Enforce server-side upload restrictions on public storage buckets.
-- Client-side validation (magic-byte sniffing, size caps) can be bypassed by
-- calling the Supabase storage API directly with a valid session token, so
-- the buckets themselves must also reject oversized or non-image uploads.

UPDATE storage.buckets
SET file_size_limit = 5242880, -- 5MB
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
WHERE id IN ('public', 'group-logos', 'recipe-images');
