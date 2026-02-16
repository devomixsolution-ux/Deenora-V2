
import React, { useState, useEffect } from 'react';
import { X, Send, MessageSquare, Loader2, AlertCircle, CheckCircle2, ChevronDown, BookOpen } from 'lucide-react';
import { t } from '../translations';
import { Language, Student, Madrasah, SMSTemplate } from '../types';
import { supabase, smsApi } from '../supabase';

interface SMSModalProps {
  students: Student[];
  madrasah: Madrasah;
  lang: Language;
  onClose: () => void;
  onSuccess: () => void;
}

const SMSModal: React.FC<SMSModalProps> = ({ students, madrasah, lang, onClose, onSuccess }) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, [madrasah.id]);

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from('sms_templates')
      .select('*')
      .eq('madrasah_id', madrasah.id)
      .order('created_at', { ascending: false });
    if (data) setTemplates(data);
  };

  const handleSend = async () => {
    if (!message.trim() || students.length === 0) return;
    setSending(true);
    setStatus('idle');
    try {
      await smsApi.sendBulk(madrasah.id, students, message);
      setStatus('success');
      setTimeout(() => { onSuccess(); onClose(); }, 1500);
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(lang === 'bn' ? 'ব্যালেন্স নেই অথবা নেটওয়ার্ক সমস্যা' : 'Failed to send SMS');
    } finally { setSending(false); }
  };

  const selectTemplate = (tmp: SMSTemplate) => {
    setMessage(tmp.body);
    setShowTemplateDropdown(false);
  };

  if (status === 'success') {
    return (
      <div className="fixed inset-0 bg-[#080A12]/40 backdrop-blur-2xl z-[500] flex items-center justify-center p-8 animate-in fade-in zoom-in-95">
        <div className="bg-white rounded-[3.5rem] p-12 flex flex-col items-center text-center shadow-2xl border border-[#8D30F4]/5">
           <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-8 shadow-inner">
              <CheckCircle2 size={48} strokeWidth={2.5} />
           </div>
           <h2 className="text-2xl font-black text-slate-800 mb-2 font-noto tracking-tight">সফল হয়েছে!</h2>
           <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em]">{students.length} SMS Sent</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#080A12]/40 backdrop-blur-2xl z-[500] flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-sm rounded-[3.5rem] shadow-[0_40px_100px_rgba(141,48,244,0.2)] p-10 border border-[#8D30F4]/5 animate-in zoom-in-95 relative overflow-hidden">
        <button onClick={onClose} className="absolute top-10 right-10 text-slate-300 hover:text-slate-800 transition-all p-1">
          <X size={26} />
        </button>

        <div className="flex items-center gap-5 mb-10">
          <div className="w-16 h-16 bg-[#8D30F4]/5 rounded-[1.5rem] flex items-center justify-center text-[#8D30F4] shadow-inner border border-[#8D30F4]/5">
            <MessageSquare size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 font-noto leading-tight tracking-tight">এসএমএস পাঠান</h2>
            <p className="text-[10px] font-black text-[#8D30F4]/60 uppercase tracking-[0.15em] mt-1.5">{students.length} জন ছাত্র নির্বাচিত</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="relative">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2.5 block">টেমপ্লেট বেছে নিন</label>
            <button onClick={() => setShowTemplateDropdown(!showTemplateDropdown)} className="w-full flex items-center justify-between px-6 py-4.5 bg-slate-50 border border-slate-100 rounded-2xl text-slate-600 text-sm font-bold transition-all shadow-sm">
              <div className="flex items-center gap-3">
                <BookOpen size={18} className="text-[#8D30F4]" />
                <span className="truncate">Saved Templates</span>
              </div>
              <ChevronDown size={20} className={`text-slate-300 transition-transform duration-300 ${showTemplateDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showTemplateDropdown && (
              <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-slate-100 z-[510] max-h-56 overflow-y-auto p-2">
                {templates.map(tmp => (
                  <button key={tmp.id} onClick={() => selectTemplate(tmp)} className="w-full text-left px-5 py-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 rounded-xl transition-colors">
                    <p className="text-[10px] font-black text-[#8D30F4] uppercase mb-0.5">{tmp.title}</p>
                    <p className="text-xs font-bold text-slate-500 truncate">{tmp.body}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">বার্তা লিখুন</label>
               <span className="text-[10px] font-black text-[#8D30F4] uppercase tracking-widest">{message.length}/160</span>
            </div>
            <textarea className="w-full h-36 px-6 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] outline-none text-slate-700 font-medium text-sm focus:border-[#8D30F4]/30 transition-all resize-none shadow-inner leading-relaxed" placeholder="এখানে মেসেজ লিখুন..." value={message} onChange={(e) => setMessage(e.target.value)} maxLength={160} />
          </div>

          {status === 'error' && (
            <div className="bg-red-50 p-4 rounded-2xl flex items-center gap-3 text-red-500 text-[11px] font-black border border-red-100 animate-in slide-in-from-top-2">
              <AlertCircle size={16} className="shrink-0" /> {errorMsg}
            </div>
          )}

          <button onClick={handleSend} disabled={sending || !message.trim()} className="w-full py-5 premium-btn text-white font-black rounded-[2rem] shadow-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-lg font-noto disabled:opacity-30">
            {sending ? <Loader2 className="animate-spin" size={24} /> : <><Send size={22} /> বার্তা পাঠান</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SMSModal;
