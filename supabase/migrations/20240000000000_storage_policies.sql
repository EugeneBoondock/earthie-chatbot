-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'publicpfp' AND
    auth.role() = 'authenticated'
  );

-- Policy to allow public read access
CREATE POLICY "Allow public read access" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'publicpfp');

-- Policy to allow users to update their own files
CREATE POLICY "Allow users to update own files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'publicpfp' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'publicpfp' AND owner = auth.uid());

-- Policy to allow users to delete their own files
CREATE POLICY "Allow users to delete own files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'publicpfp' AND owner = auth.uid()); 