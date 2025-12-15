-- Create a storage bucket for group logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('group-logos', 'group-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policy to allow authenticated users to upload group logos
CREATE POLICY "Authenticated users can upload group logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'group-logos' AND (storage.foldername(name))[1] = 'group-logos');

-- Allow anyone to read group logos
CREATE POLICY "Anyone can view group logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'group-logos');

-- Allow users to delete group logos
CREATE POLICY "Users can delete group logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'group-logos');

-- Allow users to update group logos
CREATE POLICY "Users can update group logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'group-logos');
