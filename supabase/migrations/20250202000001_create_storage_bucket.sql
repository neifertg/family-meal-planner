-- Create a public storage bucket for family photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('public', 'public', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policy to allow authenticated users to upload
CREATE POLICY "Authenticated users can upload family photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'public' AND (storage.foldername(name))[1] = 'family-photos');

-- Allow anyone to read public photos
CREATE POLICY "Anyone can view family photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'public' AND (storage.foldername(name))[1] = 'family-photos');

-- Allow users to delete their own photos
CREATE POLICY "Users can delete their own family photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'public' AND (storage.foldername(name))[1] = 'family-photos');
