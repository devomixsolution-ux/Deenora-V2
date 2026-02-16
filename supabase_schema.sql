
-- ... (Existing schema above) ...

-- ১৮. রিয়েলটাইম এনাবল করা (Enable Realtime)
-- This allows the app to listen for live changes to user status
BEGIN;
  -- Remove existing if any to avoid errors
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE public.madrasahs, public.teachers;
COMMIT;

-- Ensure replication identity is set to capture all changes
ALTER TABLE public.madrasahs REPLICA IDENTITY FULL;
ALTER TABLE public.teachers REPLICA IDENTITY FULL;
