
CREATE POLICY "recordings: agent upload own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'call-recordings' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "recordings: agent read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'call-recordings' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'manager')));
CREATE POLICY "recordings: agent delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'call-recordings' AND (storage.foldername(name))[1] = auth.uid()::text);
