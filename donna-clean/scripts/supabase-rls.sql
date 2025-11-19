-- Run this in Supabase SQL editor to ensure realtime broadcasts work per-user.
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable realtime"
ON entries
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (true);

-- ENABLE REALTIME ON entries;
ALTER PUBLICATION supabase_realtime ADD TABLE entries;
