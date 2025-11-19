-- Run this in Supabase SQL editor to ensure realtime broadcasts work per-user.
CREATE POLICY "Enable realtime broadcast"
ON entries
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (true);
