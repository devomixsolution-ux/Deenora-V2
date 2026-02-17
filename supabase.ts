
import { createClient } from '@supabase/supabase-js';
import { Student, Madrasah } from './types';

const supabaseUrl = 'https://uiqzzuqpgwziufghmqee.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpcXp6dXFwZ3d6aXVmZ2htcWVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNDk2MzMsImV4cCI6MjA4NjgyNTYzM30.CpkKwO1_49WjM-jQk9H08elomIESQBzV9hUmiT218sg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'madrasah_auth_token'
  }
});

export const smsApi = {
  getGlobalSettings: async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .maybeSingle();
      
      const defaults = { 
        reve_api_key: 'aa407e1c6629da8e', 
        reve_secret_key: '91051e7e', 
        bkash_number: '০১৭৬৬-XXXXXX', 
        reve_caller_id: '1234',
        reve_client_id: ''
      };

      if (!data) return defaults;
      
      return {
        reve_api_key: data.reve_api_key || defaults.reve_api_key,
        reve_secret_key: data.reve_secret_key || defaults.reve_secret_key,
        reve_caller_id: data.reve_caller_id || defaults.reve_caller_id,
        bkash_number: data.bkash_number || defaults.bkash_number,
        reve_client_id: data.reve_client_id || defaults.reve_client_id
      };
    } catch (e) {
      return { 
        reve_api_key: 'aa407e1c6629da8e', 
        reve_secret_key: '91051e7e', 
        bkash_number: '০১৭৬৬-XXXXXX', 
        reve_caller_id: '1234',
        reve_client_id: ''
      };
    }
  },

  sendBulk: async (madrasahId: string, students: Student[], message: string) => {
    // 1. Fetch settings and profile
    const [mRes, global] = await Promise.all([
      supabase.from('madrasahs').select('sms_balance, reve_api_key, reve_secret_key, reve_caller_id, reve_client_id').eq('id', madrasahId).single(),
      smsApi.getGlobalSettings()
    ]);

    const mData = mRes.data;
    if (!mData) throw new Error("মাদরাসা প্রোফাইল লোড করা যায়নি।");
    
    const balance = mData.sms_balance || 0;
    if (balance < students.length) {
      throw new Error(`ব্যালেন্স পর্যাপ্ত নয়। প্রয়োজন: ${students.length}, আছে: ${balance}`);
    }

    // 2. Deduct balance via RPC
    const { data: rpcData, error: rpcError } = await supabase.rpc('send_bulk_sms_rpc', {
      p_madrasah_id: madrasahId,
      p_student_ids: students.map(s => s.id),
      p_message: message
    });

    if (rpcError) throw new Error("ব্যালেন্স আপডেট করতে সমস্যা হয়েছে: " + rpcError.message);
    if (rpcData && rpcData.success === false) throw new Error(rpcData.error || "ট্রানজ্যাকশন সফল হয়নি।");

    // 3. Prepare credentials
    const apiKey = (mData.reve_api_key && mData.reve_api_key.trim() !== '') ? mData.reve_api_key : global.reve_api_key;
    const secretKey = (mData.reve_secret_key && mData.reve_secret_key.trim() !== '') ? mData.reve_secret_key : global.reve_secret_key;
    const callerId = (mData.reve_caller_id && mData.reve_caller_id.trim() !== '') ? mData.reve_caller_id : global.reve_caller_id;
    const clientId = (mData.reve_client_id && mData.reve_client_id.trim() !== '') ? mData.reve_client_id : global.reve_client_id;

    // 4. Batch Processing (Smaller chunks for reliable URL length)
    const chunkSize = 20; 
    const batches: any[][] = [];
    
    for (let i = 0; i < students.length; i += chunkSize) {
      const chunk = students.slice(i, i + chunkSize);
      const contentBatch = chunk.map(s => {
        let p = s.guardian_phone.replace(/\D/g, '');
        const target = p.startsWith('88') ? p : `88${p}`;
        return {
          callerID: callerId,
          toUser: target,
          messageContent: message
        };
      });
      batches.push(contentBatch);
    }

    // 5. Fire SMS Requests
    const sendPromises = batches.map(async (contentArray) => {
      // type=3 is for Unicode (Bengali). type=1 for English.
      let apiUrl = `https://smpp.revesms.com:7790/send?apikey=${apiKey}&secretkey=${secretKey}&type=3&content=${encodeURIComponent(JSON.stringify(contentArray))}`;
      
      if (clientId) {
        apiUrl += `&clientid=${clientId}`;
      }

      try {
        // We use no-cors because most SMS gateways don't support CORS preflight
        await fetch(apiUrl, { mode: 'no-cors', cache: 'no-cache' });
      } catch (err) {
        console.warn("SMS batch trigger might have failed network check, but proceeded due to no-cors mode.");
      }
    });

    await Promise.all(sendPromises);
    return { success: true };
  },

  sendDirect: async (phone: string, message: string, madrasahId?: string) => {
    const global = await smsApi.getGlobalSettings();
    let apiKey = global.reve_api_key;
    let secretKey = global.reve_secret_key;
    let callerId = global.reve_caller_id;
    let clientId = global.reve_client_id;

    if (madrasahId) {
      const { data } = await supabase
        .from('madrasahs')
        .select('reve_api_key, reve_secret_key, reve_caller_id, reve_client_id')
        .eq('id', madrasahId)
        .maybeSingle();
        
      if (data) {
        if (data.reve_api_key && data.reve_api_key.trim() !== '') apiKey = data.reve_api_key;
        if (data.reve_secret_key && data.reve_secret_key.trim() !== '') secretKey = data.reve_secret_key;
        if (data.reve_caller_id && data.reve_caller_id.trim() !== '') callerId = data.reve_caller_id;
        if (data.reve_client_id && data.reve_client_id.trim() !== '') clientId = data.reve_client_id;
      }
    }

    const p = phone.replace(/\D/g, '');
    const target = p.startsWith('88') ? p : `88${p}`;
    const content = [{ callerID: callerId, toUser: target, messageContent: message }];
    
    let apiUrl = `https://smpp.revesms.com:7790/send?apikey=${apiKey}&secretkey=${secretKey}&type=3&content=${encodeURIComponent(JSON.stringify(content))}`;
    
    if (clientId) apiUrl += `&clientid=${clientId}`;
    
    try { await fetch(apiUrl, { mode: 'no-cors' }); } catch (e) {}
  }
};

export const offlineApi = {
  setCache: (key: string, data: any) => { try { localStorage.setItem(`cache_${key}`, JSON.stringify(data)); } catch (e) {} },
  getCache: (key: string) => { try { const cached = localStorage.getItem(`cache_${key}`); return cached ? JSON.parse(cached) : null; } catch (e) { return null; } },
  removeCache: (key: string) => localStorage.removeItem(`cache_${key}`),
  queueAction: (table: string, type: 'INSERT' | 'UPDATE' | 'DELETE', payload: any) => {
    const queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
    queue.push({ id: Math.random().toString(36).substr(2, 9), table, type, payload, timestamp: Date.now() });
    localStorage.setItem('sync_queue', JSON.stringify(queue));
  },
  getQueue: () => JSON.parse(localStorage.getItem('sync_queue') || '[]'),
  removeFromQueue: (id: string) => {
    const queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
    localStorage.setItem('sync_queue', JSON.stringify(queue.filter((item: any) => item.id !== id)));
  },
  processQueue: async () => {
    const queue = offlineApi.getQueue();
    if (queue.length === 0) return;
    for (const action of queue) {
      try {
        if (action.type === 'INSERT') await supabase.from(action.table).insert(action.payload);
        else if (action.type === 'UPDATE') await supabase.from(action.table).update(action.payload).eq('id', action.payload.id);
        else if (action.type === 'DELETE') await supabase.from(action.table).delete().eq('id', action.payload.id);
        offlineApi.removeFromQueue(action.id);
      } catch (e) {}
    }
  }
};
