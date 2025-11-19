-- Run this in Supabase SQL editor to ensure realtime broadcasts work per-user.
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable realtime broadcast"
ON entries
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE entries;
