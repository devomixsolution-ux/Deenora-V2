
-- ১. Classes টেবিলে sort_order কলাম যোগ করা (যদি না থাকে)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='classes' AND COLUMN_NAME='sort_order') THEN
    ALTER TABLE public.classes ADD COLUMN sort_order INTEGER DEFAULT 999;
  END IF;
END $$;

-- ২. Transactions টেবিলে sms_count কলাম যোগ করা
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='transactions' AND COLUMN_NAME='sms_count') THEN
    ALTER TABLE public.transactions ADD COLUMN sms_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- ৩. আগের ফাংশনগুলো ড্রপ করা
DROP FUNCTION IF EXISTS approve_payment_with_sms(UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS send_bulk_sms_rpc(UUID, UUID[], TEXT);

-- ৪. পেমেন্ট অনুমোদন করার জন্য উন্নত RPC ফাংশন
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

-- ৫. বাল্ক এসএমএস এর জন্য ব্যালেন্স আপডেট ফাংশন
CREATE OR REPLACE FUNCTION send_bulk_sms_rpc(p_madrasah_id UUID, p_student_ids UUID[], p_message TEXT)
RETURNS JSON AS $$
DECLARE
  v_cost INTEGER;
  v_balance INTEGER;
BEGIN
  v_cost := array_length(p_student_ids, 1);
  SELECT sms_balance INTO v_balance FROM madrasahs WHERE id = p_madrasah_id;
  
  IF v_balance IS NULL OR v_balance < v_cost THEN
    RETURN json_build_object('success', false, 'error', 'পর্যাপ্ত ব্যালেন্স নেই। আপনার বর্তমান ব্যালেন্স: ' || COALESCE(v_balance, 0));
  END IF;
  
  UPDATE madrasahs SET sms_balance = sms_balance - v_cost WHERE id = p_madrasah_id;
  
  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;
