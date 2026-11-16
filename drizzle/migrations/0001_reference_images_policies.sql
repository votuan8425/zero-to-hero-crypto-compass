CREATE POLICY "ref images select own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'reference-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "ref images insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'reference-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "ref images update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'reference-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "ref images delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'reference-images' AND (storage.foldername(name))[1] = auth.uid()::text);