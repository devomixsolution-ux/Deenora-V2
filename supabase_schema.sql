
-- ১. প্রয়োজনীয় টেবিলগুলো তৈরি করা (যদি না থাকে)

CREATE TABLE IF NOT EXISTS public.madrasahs (
    id UUID PRIMARY KEY, -- auth.users.id এর সাথে লিঙ্ক হবে
    name TEXT NOT NULL,
    phone TEXT,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    is_super_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    email TEXT,
    login_code TEXT,
    balance INTEGER DEFAULT 0,
    sms_balance INTEGER DEFAULT 0,
    reve_api_key TEXT,
    reve_secret_key TEXT,
    reve_caller_id TEXT,
    reve_client_id TEXT
);

CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
    class_name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 999,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    roll INTEGER,
    guardian_name TEXT,
    guardian_phone TEXT NOT NULL,
    guardian_phone_2 TEXT,
    photo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    login_code TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    permissions JSONB DEFAULT '{"can_manage_students": true, "can_manage_classes": true, "can_send_sms": true, "can_send_free_sms": true}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recent_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    called_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sms_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    madrasah_id UUID REFERENCES public.madrasahs(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    sms_count INTEGER DEFAULT 0,
    transaction_id TEXT NOT NULL,
    sender_phone TEXT NOT NULL,
    description TEXT,
    type TEXT CHECK (type IN ('credit', 'debit')),
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_sms_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    remaining_sms INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ২. কলাম আপডেট (যদি টেবিল আগে থেকেই থাকে কিন্তু কলাম না থাকে)

DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='classes' AND COLUMN_NAME='sort_order') THEN
    ALTER TABLE public.classes ADD COLUMN sort_order INTEGER DEFAULT 999;
  END IF;
END $$;

DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='transactions' AND COLUMN_NAME='sms_count') THEN
    ALTER TABLE public.transactions ADD COLUMN sms_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- ৩. ফাংশন এবং ইনডেক্স আপডেট

DROP FUNCTION IF EXISTS approve_payment_with_sms(UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS send_bulk_sms_rpc(UUID, UUID[], TEXT);

CREATE OR REPLACE FUNCTION approve_payment_with_sms(t_id UUID, m_id UUID, sms_to_give INTEGER)
RETURNS JSON AS $$
DECLARE
    current_admin_stock INTEGER;
    stock_id UUID;
BEGIN
    SELECT id, remaining_sms INTO stock_id, current_admin_stock FROM admin_sms_stock LIMIT 1;
    
    IF stock_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'অ্যাডমিন স্টক টেবিল সেটআপ করা নেই।');
    END IF;

    IF current_admin_stock IS NULL OR current_admin_stock < sms_to_give THEN
        RETURN json_build_object('success', false, 'error', 'অ্যাডমিন স্টকে পর্যাপ্ত SMS নেই।');
    END IF;

    UPDATE transactions 
    SET status = 'approved', 
        sms_count = sms_to_give 
    WHERE id = t_id;

    UPDATE madrasahs 
    SET sms_balance = COALESCE(sms_balance, 0) + sms_to_give 
    WHERE id = m_id;

    UPDATE admin_sms_stock 
    SET remaining_sms = remaining_sms - sms_to_give
    WHERE id = stock_id;

    RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION send_bulk_sms_rpc(p_madrasah_id UUID, p_student_ids UUID[], p_message TEXT)
RETURNS JSON AS $$
DECLARE
  v_student_count INTEGER;
  v_sms_count_per_student INTEGER;
  v_total_cost INTEGER;
  v_balance INTEGER;
  v_is_unicode BOOLEAN;
BEGIN
  v_student_count := array_length(p_student_ids, 1);
  v_is_unicode := (length(p_message) != length(convert_to(p_message, 'LATIN1')));

  IF v_is_unicode THEN
    IF length(p_message) <= 70 THEN
      v_sms_count_per_student := 1;
    ELSE
      v_sms_count_per_student := CEIL(length(p_message)::FLOAT / 67);
    END IF;
  ELSE
    IF length(p_message) <= 160 THEN
      v_sms_count_per_student := 1;
    ELSE
      v_sms_count_per_student := CEIL(length(p_message)::FLOAT / 153);
    END IF;
  END IF;

  v_total_cost := v_student_count * v_sms_count_per_student;

  SELECT sms_balance INTO v_balance FROM madrasahs WHERE id = p_madrasah_id;
  
  IF v_balance IS NULL OR v_balance < v_total_cost THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'পর্যাপ্ত ব্যালেন্স নেই। মোট প্রয়োজন: ' || v_total_cost || ' SMS, আপনার আছে: ' || COALESCE(v_balance, 0) || ' SMS'
    );
  END IF;
  
  UPDATE madrasahs SET sms_balance = sms_balance - v_total_cost WHERE id = p_madrasah_id;
  
  RETURN json_build_object(
    'success', true, 
    'cost', v_total_cost, 
    'sms_per_student', v_sms_count_per_student
  );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

CREATE INDEX IF NOT EXISTS idx_students_madrasah ON public.students(madrasah_id);
