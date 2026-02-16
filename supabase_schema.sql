
-- ১. এক্সটেনশন এনাবল করা
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ২. মাদরাসা (Madrasahs) টেবিল
CREATE TABLE IF NOT EXISTS public.madrasahs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone TEXT,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    is_super_admin BOOLEAN DEFAULT false,
    login_code TEXT,
    email TEXT UNIQUE,
    sms_balance INTEGER DEFAULT 0,
    reve_api_key TEXT,
    reve_secret_key TEXT,
    reve_caller_id TEXT,
    reve_client_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ৩. ক্লাস (Classes) টেবিল
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
    class_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ৪. ছাত্র (Students) টেবিল
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    roll INTEGER,
    guardian_name TEXT,
    guardian_phone TEXT NOT NULL,
    guardian_phone_2 TEXT,
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(class_id, roll)
);

-- ৫. শিক্ষক (Teachers) টেবিল
CREATE TABLE IF NOT EXISTS public.teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    login_code TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    permissions JSONB DEFAULT '{"can_manage_students": true, "can_manage_classes": false, "can_send_sms": false, "can_send_free_sms": true}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ৬. কল হিস্ট্রি (Recent Calls)
CREATE TABLE IF NOT EXISTS public.recent_calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    called_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ৭. এসএমএস টেমপ্লেট (SMS Templates)
CREATE TABLE IF NOT EXISTS public.sms_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ৮. লেনদেন (Transactions)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    transaction_id TEXT UNIQUE NOT NULL,
    sender_phone TEXT,
    description TEXT,
    type TEXT CHECK (type IN ('credit', 'debit')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ৯. সিস্টেম সেটিংস (System Settings)
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',
    reve_api_key TEXT,
    reve_secret_key TEXT,
    reve_caller_id TEXT,
    reve_client_id TEXT,
    bkash_number TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ১০. অ্যাডমিন এসএমএস স্টক (Admin SMS Stock)
CREATE TABLE IF NOT EXISTS public.admin_sms_stock (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    remaining_sms INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ১১. আরএলএস পলিসি (Row Level Security) - Super Admin full access
ALTER TABLE public.madrasahs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Madrasahs Access" ON public.madrasahs FOR ALL USING (true);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Classes Access" ON public.classes FOR ALL USING (true);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Students Access" ON public.students FOR ALL USING (true);

ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Teachers Access" ON public.teachers FOR ALL USING (true);

ALTER TABLE public.recent_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Calls Access" ON public.recent_calls FOR ALL USING (true);

ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Templates Access" ON public.sms_templates FOR ALL USING (true);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Transactions Access" ON public.transactions FOR ALL USING (true);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Settings Access" ON public.system_settings FOR ALL USING (true);

ALTER TABLE public.admin_sms_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Stock Access" ON public.admin_sms_stock FOR ALL USING (true);

-- ১২. স্বয়ংক্রিয় প্রোফাইল ক্রিয়েশন ট্রিগার (যাতে Auth ইউজার তৈরির সাথে সাথে ডাটাবেসে সেভ হয়)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.madrasahs (id, email, name, is_active, is_super_admin)
  VALUES (new.id, new.email, split_part(new.email, '@', 1), true, false)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ট্রিগারটি ড্রপ করে পুনরায় তৈরি করা
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ১৩. ফাংশন: বাল্ক এসএমএস ব্যালেন্স আপডেট (RPC)
CREATE OR REPLACE FUNCTION public.send_bulk_sms_rpc(
    p_madrasah_id UUID,
    p_student_ids UUID[],
    p_message TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
    v_current_balance INTEGER;
BEGIN
    v_count := array_length(p_student_ids, 1);
    SELECT sms_balance INTO v_current_balance FROM public.madrasahs WHERE id = p_madrasah_id;
    IF v_current_balance < v_count THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
    END IF;
    UPDATE public.madrasahs SET sms_balance = sms_balance - v_count WHERE id = p_madrasah_id;
    RETURN jsonb_build_object('success', true, 'new_balance', v_current_balance - v_count);
END;
$$;

-- ১৪. ফাংশন: পেমেন্ট অ্যাপ্রুভ এবং এসএমএস ক্রেডিট করা (RPC)
CREATE OR REPLACE FUNCTION public.approve_payment_with_sms(
    t_id UUID,
    m_id UUID,
    sms_to_give INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.transactions SET status = 'approved' WHERE id = t_id;
    UPDATE public.madrasahs SET sms_balance = sms_balance + sms_to_give WHERE id = m_id;
    UPDATE public.admin_sms_stock SET remaining_sms = remaining_sms - sms_to_give;
    RETURN jsonb_build_object('success', true);
END;
$$;

-- ১৫. ডেটা ইনসার্ট (System Settings)
INSERT INTO public.system_settings (id, reve_api_key, reve_secret_key, reve_caller_id, bkash_number)
VALUES ('00000000-0000-0000-0000-000000000001', 'aa407e1c6629da8e', '91051e7e', 'Deenora', '০১৭৬৬-XXXXXX')
ON CONFLICT (id) DO NOTHING;

-- ১৬. সুপার অ্যাডমিন ইনসার্ট
INSERT INTO public.madrasahs (id, name, email, is_super_admin, is_active, login_code)
VALUES ('fe678ac3-da4b-4b41-8688-b04aceb71959', 'Deenora Super Admin', 'kmibrahim@gmail.com', true, true, '269596')
ON CONFLICT (id) DO UPDATE SET is_super_admin = true, login_code = '269596';

-- ১৭. ইনিশিয়াল এসএমএস স্টক
INSERT INTO public.admin_sms_stock (remaining_sms) VALUES (10000) ON CONFLICT DO NOTHING;
