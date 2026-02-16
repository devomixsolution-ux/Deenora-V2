
-- ১. রিসেন্ট কল টেবিল তৈরি (যদি না থাকে)
CREATE TABLE IF NOT EXISTS public.recent_calls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    called_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ২. রিসেন্ট কল (Recent Calls) টেবিলের জন্য পলিসি
ALTER TABLE public.recent_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anyone to read recent calls" ON public.recent_calls;
CREATE POLICY "Allow anyone to read recent calls" ON public.recent_calls
    FOR SELECT TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Allow anyone to insert recent calls" ON public.recent_calls;
CREATE POLICY "Allow anyone to insert recent calls" ON public.recent_calls
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

-- ৩. স্টুডেন্ট (Students) টেবিলের জন্য রিড পলিসি (হিস্ট্রি দেখানোর জন্য জরুরি)
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anyone to read students" ON public.students;
CREATE POLICY "Allow anyone to read students" ON public.students
    FOR SELECT TO anon, authenticated
    USING (true);

-- ৪. ক্লাস (Classes) টেবিলের জন্য রিড পলিসি
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anyone to read classes" ON public.classes;
CREATE POLICY "Allow anyone to read classes" ON public.classes
    FOR SELECT TO anon, authenticated
    USING (true);

-- ৫. ট্রানজ্যাকশন ও অন্যান্য
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to insert transaction requests" ON public.transactions;
CREATE POLICY "Allow users to insert transaction requests" ON public.transactions FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow users to read own transactions" ON public.transactions;
CREATE POLICY "Allow users to read own transactions" ON public.transactions FOR SELECT TO anon, authenticated USING (true);
