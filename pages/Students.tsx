
import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Plus, Search, CheckCircle2, MessageSquare, X, BookOpen, ChevronDown, Check, PhoneCall, Smartphone, Loader2, ListChecks, MessageCircle, Phone } from 'lucide-react';
import { supabase, offlineApi, smsApi } from '../supabase';
import { Class, Student, Language, Teacher } from '../types';
import { t } from '../translations';

interface StudentsProps {
  selectedClass: Class;
  onStudentClick: (student: Student) => void;
  onAddClick: () => void;
  onBack: () => void;
  lang: Language;
  dataVersion: number;
  triggerRefresh: () => void;
  canAdd?: boolean;
  canSendSMS?: boolean;
  teacher?: Teacher | null;
  madrasahId?: string;
}

const STATIC_DEFAULTS = [
  { id: 'def-1', title: 'উপস্থিতি (Attendance)', body: 'আস-সালামু আলাইকুম, আজ আপনার সন্তান মাদরাসায় উপস্থিত হয়েছে। ধন্যবাদ।' },
  { id: 'def-2', title: 'অনুপস্থিতি (Absence)', body: 'আস-সালামু আলাইকুম, আজ আপনার সন্তান মাদরাসায় অনুপস্থিত। অনুগ্রহ করে কারণ জানান।' }
];

const Students: React.FC<StudentsProps> = ({ selectedClass, onStudentClick, onAddClick, onBack, lang, dataVersion, triggerRefresh, canAdd, canSendSMS, teacher, madrasahId }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchStudents();
    fetchTemplates();
  }, [selectedClass.id, dataVersion, madrasahId]);

  const filteredStudents = useMemo(() => {
    let list = students;
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      list = list.filter(s => s.student_name.toLowerCase().includes(lowerQuery));
    }
    return list;
  }, [searchQuery, students]);

  const allFilteredSelected = useMemo(() => {
    if (filteredStudents.length === 0) return false;
    return filteredStudents.every(s => selectedIds.has(s.id));
  }, [filteredStudents, selectedIds]);

  const fetchTemplates = async () => {
    if (!madrasahId) return;
    try {
      const { data } = await supabase
        .from('sms_templates')
        .select('*')
        .eq('madrasah_id', madrasahId)
        .order('created_at', { ascending: false });
      setTemplates(data && data.length > 0 ? data : STATIC_DEFAULTS);
    } catch (err) { setTemplates(STATIC_DEFAULTS); }
  };

  const fetchStudents = async () => {
    if (!madrasahId) return;
    setLoading(true);
    if (navigator.onLine) {
      try {
        const { data } = await supabase
          .from('students')
          .select('*, classes(*)').eq('madrasah_id', madrasahId)
          .eq('class_id', selectedClass.id)
          .order('roll', { ascending: true, nullsFirst: false });
        if (data) setStudents(data);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    } else { setLoading(false); }
  };

  const recordCall = async (studentId: string) => {
    if (!madrasahId || !studentId) return;
    try {
      await supabase.from('recent_calls').insert({
        madrasah_id: madrasahId,
        student_id: studentId,
        called_at: new Date().toISOString()
      });
      triggerRefresh();
    } catch (e) { console.error("recordCall Error:", e); }
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id); else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    const newSelected = new Set(selectedIds);
    if (allFilteredSelected) {
      filteredStudents.forEach(s => newSelected.delete(s.id));
    } else {
      filteredStudents.forEach(s => newSelected.add(s.id));
    }
    setSelectedIds(newSelected);
  };

  const handleNativeSMS = () => {
    if (!selectedTemplate || selectedIds.size === 0) return;
    const selectedStudents = students.filter(s => selectedIds.has(s.id));
    const phones = selectedStudents.map(s => s.guardian_phone).join(',');
    const message = encodeURIComponent(selectedTemplate.body);
    const separator = /iPad|iPhone|iPod/.test(navigator.userAgent) ? '&' : '?';
    window.location.href = `sms:${phones}${separator}body=${message}`;
  };

  const handlePremiumSMS = async () => {
    if (!selectedTemplate || selectedIds.size === 0 || !madrasahId) return;
    setSending(true);
    try {
      const selectedStudents = students.filter(s => selectedIds.has(s.id));
      await smsApi.sendBulk(madrasahId, selectedStudents, selectedTemplate.body);
      alert(lang === 'bn' ? 'এসএমএস সফলভাবে পাঠানো হয়েছে' : 'SMS sent successfully');
      setIsSelectionMode(false);
      setSelectedIds(new Set());
    } catch (err: any) {
      alert(lang === 'bn' ? 'ব্যার্থ হয়েছে: ' + err.message : 'Failed: ' + err.message);
    } finally { setSending(false); }
  };

  const initiateNormalCall = async (studentId: string, phone: string) => {
    await recordCall(studentId);
    window.location.href = `tel:${phone}`;
  };

  const initiateWhatsAppCall = async (studentId: string, phone: string) => {
     await recordCall(studentId);
     window.location.href = `https://wa.me/88${phone.replace(/\D/g, '')}`;
  }

  const canSendSystemSMS = !teacher || teacher.permissions?.can_send_sms;
  const canSendFreeSMS = !teacher || teacher.permissions?.can_send_free_sms;
  const canAnySMS = canSendSystemSMS || canSendFreeSMS;

  return (
    <div className="space-y-4 animate-in slide-in-from-right-4 duration-300 pb-10">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onBack} className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-2xl text-white active:scale-90 transition-all border border-white/20 shadow-xl flex items-center justify-center">
              <ArrowLeft size={22} strokeWidth={3} />
            </button>
            <div className="min-w-0">
              <h1 className="text-[17px] font-black text-white truncate font-noto leading-tight drop-shadow-md">{selectedClass.class_name}</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                <p className="text-[9px] font-black text-white/80 uppercase tracking-widest leading-none">
                  {students.length} {t('students_count', lang)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {canAnySMS && (
              <>
                {isSelectionMode && (
                  <button onClick={toggleSelectAll}
                    className={`shrink-0 h-10 px-3.5 rounded-2xl transition-all active:scale-95 border flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-wider ${allFilteredSelected ? 'bg-white text-[#8D30F4] border-white shadow-xl' : 'bg-white/20 text-white border-white/20'}`}>
                    <ListChecks size={18} strokeWidth={3} />
                    {allFilteredSelected ? (lang === 'bn' ? 'মুছুন' : 'Clear') : (lang === 'bn' ? 'সব' : 'All')}
                  </button>
                )}
                <button onClick={() => { setIsSelectionMode(!isSelectionMode); if (isSelectionMode) setSelectedIds(new Set()); }}
                  className={`shrink-0 w-10 h-10 rounded-2xl transition-all active:scale-95 border flex items-center justify-center ${isSelectionMode ? 'bg-white text-[#8D30F4] border-white shadow-xl' : 'bg-white/20 text-white border-white/20'}`}>
                  {isSelectionMode ? <X size={18} strokeWidth={3} /> : <CheckCircle2 size={18} strokeWidth={2.5} />}
                </button>
              </>
            )}
            {!isSelectionMode && canAdd && (
              <button onClick={onAddClick} className="premium-btn text-white px-4 py-2.5 rounded-2xl text-[11px] font-black flex items-center gap-2 shadow-xl active:scale-95 transition-all border border-white/20">
                <Plus size={14} strokeWidth={4} /> {t('add_student', lang)}
              </button>
            )}
          </div>
        </div>

        <div className="relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[#4B168A] group-focus-within:scale-110 transition-transform" size={18} strokeWidth={3} />
          <input type="text" placeholder={t('search_placeholder', lang)}
            className="w-full pl-12 pr-6 py-3.5 bg-white/95 backdrop-blur-md border-2 border-transparent rounded-[1.2rem] outline-none text-[#2D3142] placeholder:text-[#9B6DFF] font-black text-sm focus:border-[#8D30F4] shadow-xl transition-all"
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {filteredStudents.map(student => (
          <div key={student.id} onClick={() => isSelectionMode ? toggleSelection(student.id) : onStudentClick(student)}
            className={`p-3 rounded-[1.2rem] border backdrop-blur-md transition-all flex items-center justify-between shadow-md relative overflow-hidden ${isSelectionMode && selectedIds.has(student.id) ? 'bg-white text-[#8D30F4] border-[#8D30F4] scale-[1.01]' : 'bg-white/95 border-white/40 active:scale-[0.98]'}`}>
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              {isSelectionMode ? (
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border-2 shrink-0 transition-all ${selectedIds.has(student.id) ? 'bg-[#8D30F4] text-white border-[#8D30F4]' : 'bg-slate-50 border-slate-100 text-slate-200'}`}>
                  <CheckCircle2 size={22} fill={selectedIds.has(student.id) ? "white" : "none"} />
                </div>
              ) : (
                <div className="w-11 h-11 rounded-2xl flex flex-col items-center justify-center border shrink-0 bg-[#F2EBFF] border-[#8D30F4]/10 text-[#8D30F4] shadow-inner">
                  <span className="text-[7px] font-black opacity-40 uppercase leading-none">Roll</span>
                  <span className="text-base font-black leading-none mt-1">{student.roll || '-'}</span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="font-black text-[#2E0B5E] text-[16px] font-noto truncate leading-tight">{student.student_name}</h3>
                <p className="text-[9px] font-black text-[#A179FF] truncate uppercase tracking-widest mt-0.5">{student.guardian_name || '-'}</p>
              </div>
            </div>
            {!isSelectionMode && (
              <div className="flex items-center gap-6 shrink-0 ml-2">
                <button onClick={(e) => { e.stopPropagation(); initiateNormalCall(student.id, student.guardian_phone); }} className="w-10 h-10 bg-[#8D30F4]/10 text-[#8D30F4] rounded-xl active:scale-90 transition-all border border-[#8D30F4]/10 flex items-center justify-center shadow-sm">
                  <Phone size={18} fill="currentColor" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); initiateWhatsAppCall(student.id, student.guardian_phone); }} className="w-10 h-10 bg-[#25d366] text-white rounded-xl shadow-lg active:scale-90 transition-all flex items-center justify-center border border-white/20">
                  <PhoneCall size={18} fill="currentColor" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {isSelectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+95px)] left-1/2 -translate-x-1/2 w-[94%] max-w-md z-[150] animate-in slide-in-from-bottom-10">
          <div className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] p-5 shadow-[0_30px_70px_rgba(46,11,94,0.5)] border border-[#8D30F4]/20 flex flex-col gap-4">
            <div className="flex gap-2">
              <button onClick={() => setShowTemplateMenu(!showTemplateMenu)} className={`w-full h-[60px] flex items-center justify-between px-6 rounded-2xl text-sm font-black transition-all border-2 ${selectedTemplate ? 'bg-[#8D30F4]/5 border-[#8D30F4]/30 text-[#8D30F4]' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                <div className="flex items-center gap-3 truncate">
                  <BookOpen size={20} className="text-[#8D30F4]" />
                  <span className="truncate font-noto">{selectedTemplate ? selectedTemplate.title : (lang === 'bn' ? 'মেসেজ টেমপ্লেট' : 'Message Template')}</span>
                </div>
                <ChevronDown size={20} className={`transition-transform duration-300 ${showTemplateMenu ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {showTemplateMenu && (
              <div className="absolute bottom-[calc(100%-40px)] left-0 right-0 mb-3 bg-white rounded-[2rem] shadow-2xl border border-slate-100 max-h-60 overflow-y-auto z-[160] p-2 animate-in slide-in-from-bottom-5">
                {templates.map(tmp => (
                  <button key={tmp.id} onClick={() => { setSelectedTemplate(tmp); setShowTemplateMenu(false); }} className={`w-full text-left px-5 py-3.5 rounded-xl flex items-center justify-between transition-all mb-1 ${selectedTemplate?.id === tmp.id ? 'bg-[#8D30F4] text-white shadow-xl' : 'hover:bg-slate-50 text-[#2E0B5E]'}`}>
                    <div className="min-w-0"><p className="text-xs font-black truncate font-noto">{tmp.title}</p></div>
                    {selectedTemplate?.id === tmp.id && <Check size={18} strokeWidth={4} />}
                  </button>
                ))}
              </div>
            )}

            <div className={`grid gap-3 ${canSendSystemSMS && canSendFreeSMS ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {canSendSystemSMS && (
                <button 
                  onClick={handlePremiumSMS} 
                  disabled={sending || !selectedTemplate} 
                  className={`h-[48px] rounded-full flex items-center justify-center gap-2 font-black text-[10px] tracking-tight uppercase shadow-lg transition-all ${selectedTemplate ? 'bg-[#8D30F4] text-white' : 'bg-slate-100 text-slate-300 opacity-50'}`}
                >
                  {sending ? <Loader2 className="animate-spin" size={16} /> : <MessageSquare size={16} fill="currentColor" />} 
                  SYSTEM SMS
                </button>
              )}
              {canSendFreeSMS && (
                <button 
                  onClick={handleNativeSMS} 
                  disabled={!selectedTemplate} 
                  className={`h-[48px] rounded-full flex items-center justify-center gap-2 font-black text-[10px] tracking-tight uppercase shadow-lg transition-all ${selectedTemplate ? 'bg-[#1A0B2E] text-white' : 'bg-slate-100 text-slate-300 opacity-50'}`}
                >
                  <Smartphone size={16} fill="currentColor" /> SIM SMS (FREE)
                </button>
              )}
            </div>
            
            <div className="flex items-center justify-center gap-2 pt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#8D30F4] animate-pulse"></div>
              <p className="text-[10px] font-black text-[#8D30F4] uppercase tracking-[0.2em]">{selectedIds.size} SELECTED</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Students;
