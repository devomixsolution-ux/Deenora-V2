
import React, { useState, useRef, useEffect } from 'react';
import { LogOut, Camera, Loader2, User as UserIcon, ShieldCheck, Database, ChevronRight, Check, MessageSquare, Zap, Globe, Smartphone, Save, Users, Layers, Edit3, UserPlus, Languages, Mail, Key, Settings, Fingerprint, Copy, History, Server, CreditCard, Shield, Sliders, Activity, Bell, RefreshCw, AlertTriangle, GraduationCap, ChevronLeft, ArrowRight, LayoutDashboard, Settings2, X, Sparkles, Box, ShieldAlert, Award, CheckCircle2 } from 'lucide-react';
import { supabase, smsApi } from '../supabase';
import { Madrasah, Language, View } from '../types';
import { t } from '../translations';

interface AccountProps {
  lang: Language;
  setLang: (l: Language) => void;
  onProfileUpdate?: () => void;
  setView: (view: View) => void;
  isSuperAdmin?: boolean;
  initialMadrasah: Madrasah | null;
  onLogout: () => void;
  isTeacher?: boolean;
}

const Account: React.FC<AccountProps> = ({ lang, setLang, onProfileUpdate, setView, isSuperAdmin, initialMadrasah, onLogout, isTeacher }) => {
  const [madrasah, setMadrasah] = useState<Madrasah | null>(initialMadrasah);
  const [saving, setSaving] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingGlobal, setIsEditingGlobal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  const [stats, setStats] = useState({ students: 0, classes: 0, teachers: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  const [newName, setNewName] = useState(initialMadrasah?.name || '');
  const [newPhone, setNewPhone] = useState(initialMadrasah?.phone || '');
  const [newLoginCode, setNewLoginCode] = useState(initialMadrasah?.login_code || '');
  const [logoUrl, setLogoUrl] = useState(initialMadrasah?.logo_url || '');
  
  const [reveApiKey, setReveApiKey] = useState(initialMadrasah?.reve_api_key || '');
  const [reveSecretKey, setReveSecretKey] = useState(initialMadrasah?.reve_secret_key || '');
  const [reveCallerId, setReveCallerId] = useState(initialMadrasah?.reve_caller_id || '');

  const [globalSettings, setGlobalSettings] = useState({
    reve_api_key: '',
    reve_secret_key: '',
    reve_caller_id: '',
    bkash_number: ''
  });
  
  const [copiedId, setCopiedId] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialMadrasah) {
      setMadrasah(initialMadrasah);
      setNewName(initialMadrasah.name || '');
      setNewPhone(initialMadrasah.phone || '');
      setNewLoginCode(initialMadrasah.login_code || '');
      setLogoUrl(initialMadrasah.logo_url || '');
      setReveApiKey(initialMadrasah.reve_api_key || '');
      setReveSecretKey(initialMadrasah.reve_secret_key || '');
      setReveCallerId(initialMadrasah.reve_caller_id || '');
      
      fetchStats();
      if (isSuperAdmin) {
        fetchGlobalSettings();
      }
    }
  }, [initialMadrasah, isSuperAdmin]);

  const fetchStats = async () => {
    if (!initialMadrasah) return;
    setLoadingStats(true);
    try {
      const { data: profile } = await supabase.from('madrasahs').select('*').eq('id', initialMadrasah.id).maybeSingle();
      if (profile) setMadrasah(profile);

      const [stdRes, clsRes, teaRes] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('madrasah_id', initialMadrasah.id),
        supabase.from('classes').select('*', { count: 'exact', head: true }).eq('madrasah_id', initialMadrasah.id),
        supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('madrasah_id', initialMadrasah.id)
      ]);

      setStats({ 
        students: stdRes.count || 0, 
        classes: clsRes.count || 0,
        teachers: teaRes.count || 0
      });
    } catch (e) { 
      console.error("Account stats fetch error:", e); 
    } finally { 
      setLoadingStats(false); 
    }
  };

  const fetchGlobalSettings = async () => {
    const settings = await smsApi.getGlobalSettings();
    setGlobalSettings({
      reve_api_key: settings.reve_api_key,
      reve_secret_key: settings.reve_secret_key,
      reve_caller_id: settings.reve_caller_id,
      bkash_number: settings.bkash_number
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleUpdate = async () => {
    if (!madrasah || isTeacher) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('madrasahs').update({ 
        name: newName.trim(), 
        phone: newPhone.trim(), 
        login_code: newLoginCode.trim(), 
        logo_url: logoUrl,
        reve_api_key: reveApiKey.trim() || null,
        reve_secret_key: reveSecretKey.trim() || null,
        reve_caller_id: reveCallerId.trim() || null
      }).eq('id', madrasah.id);
      
      if (error) throw error;
      if (onProfileUpdate) onProfileUpdate();
      setIsEditingProfile(false);
      
      setMadrasah(prev => prev ? { 
        ...prev, 
        name: newName.trim(), 
        phone: newPhone.trim(), 
        login_code: newLoginCode.trim(),
        reve_api_key: reveApiKey.trim(),
        reve_secret_key: reveSecretKey.trim(),
        reve_caller_id: reveCallerId.trim()
      } : null);

      setShowSuccessModal(true);
    } catch (err: any) { 
      alert(t('login_error', lang) + ': ' + err.message);
    } finally { setSaving(false); }
  };

  const handleSaveGlobalSettings = async () => {
    if (!isSuperAdmin) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('system_settings').update({
        reve_api_key: globalSettings.reve_api_key.trim(),
        reve_secret_key: globalSettings.reve_secret_key.trim(),
        reve_caller_id: globalSettings.reve_caller_id.trim(),
        bkash_number: globalSettings.bkash_number.trim()
      }).eq('id', '00000000-0000-0000-0000-000000000001');

      if (error) throw error;
      alert('Global System Settings Updated!');
      setIsEditingGlobal(false);
    } catch (err: any) {
      alert('Error updating global settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !madrasah || isTeacher) return;
    setSaving(true);
    try {
      const fileName = `logo_${madrasah.id}_${Date.now()}`;
      const { error: uploadError } = await supabase.storage.from('madrasah-assets').upload(`logos/${fileName}`, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('madrasah-assets').getPublicUrl(`logos/${fileName}`);
      setLogoUrl(publicUrl);
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };

  if (!madrasah) {
    return (
      <div className="flex flex-col items-center justify-center py-32 px-10 text-white text-center animate-in fade-in duration-500">
        <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mb-8 border-4 border-red-500/30">
           <AlertTriangle size={48} className="text-red-300" />
        </div>
        <h3 className="text-2xl font-black font-noto mb-4">{t('no_classes', lang)}</h3>
        <button onClick={onLogout} className="w-full py-5 bg-white text-red-600 font-black rounded-full shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3">
          <LogOut size={22} /> {t('logout', lang)}
        </button>
      </div>
    );
  }

  const StatCard = ({ icon: Icon, value, label, colorClass, delay }: { icon: any, value: number | string, label: string, colorClass: string, delay: string }) => (
    <div className={`bg-white rounded-[2.2rem] p-5 border border-slate-50 shadow-lg flex flex-col items-center text-center relative overflow-hidden group animate-in slide-in-from-bottom-4 ${delay}`}>
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-3 ${colorClass} bg-opacity-10`}>
        <Icon size={20} className={colorClass.replace('bg-', 'text-')} />
      </div>
      <div className="space-y-0.5">
        <h4 className="text-xl font-black text-[#2E0B5E] tracking-tight">
          {loadingStats ? <Loader2 className="animate-spin text-slate-200" size={14} /> : value}
        </h4>
        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      </div>
    </div>
  );

  const BentoAction = ({ icon: Icon, title, desc, onClick, theme }: { icon: any, title: string, desc: string, onClick: () => void, theme: string }) => (
    <button 
      onClick={onClick} 
      className={`relative overflow-hidden bg-white rounded-[2.5rem] p-6 shadow-xl border border-slate-50 active:scale-[0.97] transition-all hover:bg-slate-50 flex flex-col gap-4 text-left group h-full`}
    >
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:rotate-12 ${theme}`}>
        <Icon size={24} className="text-white" />
      </div>
      <div className="flex-1">
        <h5 className="text-[15px] font-black text-[#2E0B5E] font-noto leading-tight">{title}</h5>
        <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{desc}</p>
      </div>
      <div className="flex justify-end">
        <div className="w-8 h-8 rounded-full bg-slate-50 text-slate-300 flex items-center justify-center group-hover:bg-[#8D30F4] group-hover:text-white transition-all shadow-sm">
          <ArrowRight size={16} />
        </div>
      </div>
    </button>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-36 relative z-[60]">
      
      {/* Super Admin Control Hub */}
      {isSuperAdmin && (
        <div className="bg-[#1A0B2E] p-8 rounded-[3.5rem] border border-white/10 shadow-2xl space-y-8 relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform duration-1000">
              <Shield size={140} className="text-[#A179FF]" />
           </div>
           
           <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-5">
                 <div className="w-14 h-14 bg-[#8D30F4] text-white rounded-[1.5rem] flex items-center justify-center shadow-[0_0_40px_rgba(141,48,244,0.4)] border border-white/10">
                    <LayoutDashboard size={26} />
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-white font-noto tracking-tight">System Core</h3>
                    <p className="text-[9px] font-black text-[#A179FF] uppercase tracking-[0.25em] mt-1.5">Master Gateway</p>
                 </div>
              </div>
              <button 
                onClick={() => setIsEditingGlobal(!isEditingGlobal)} 
                className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all shadow-lg border border-white/10 ${isEditingGlobal ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
              >
                {isEditingGlobal ? <X size={20} /> : <Settings2 size={20} />}
              </button>
           </div>
           
           {isEditingGlobal ? (
              <div className="space-y-6 animate-in slide-in-from-top-4 duration-500 relative z-10">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white/5 p-6 rounded-3xl border border-white/10 focus-within:border-[#8D30F4]/50 transition-all shadow-inner">
                       <label className="text-[9px] font-black text-[#A179FF] uppercase tracking-widest block mb-2.5">Global API Gateway</label>
                       <input type="text" className="bg-transparent border-none outline-none font-black text-white text-sm w-full placeholder:text-white/20" value={globalSettings.reve_api_key} onChange={(e) => setGlobalSettings({...globalSettings, reve_api_key: e.target.value})} placeholder="Enter Key..." />
                    </div>
                    <div className="bg-white/5 p-6 rounded-3xl border border-white/10 focus-within:border-[#8D30F4]/50 transition-all shadow-inner">
                       <label className="text-[9px] font-black text-[#A179FF] uppercase tracking-widest block mb-2.5">Global Secret Key</label>
                       <input type="text" className="bg-transparent border-none outline-none font-black text-white text-sm w-full placeholder:text-white/20" value={globalSettings.reve_secret_key} onChange={(e) => setGlobalSettings({...globalSettings, reve_secret_key: e.target.value})} placeholder="Enter Secret..." />
                    </div>
                 </div>
                 <button onClick={handleSaveGlobalSettings} disabled={saving} className="w-full py-5 bg-[#8D30F4] text-white font-black rounded-3xl text-sm shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 border border-white/10">
                    {saving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> Update Global System</>}
                 </button>
              </div>
           ) : (
              <div className="flex gap-4 relative z-10">
                 <div className="flex-1 bg-white/5 p-6 rounded-[2.5rem] border border-white/10 flex items-center gap-4 hover:bg-white/10 transition-colors">
                    <div className="w-12 h-12 bg-green-500/20 text-green-400 rounded-2xl flex items-center justify-center">
                       <Activity size={22} />
                    </div>
                    <div>
                       <p className="text-[8px] font-black text-[#A179FF] uppercase tracking-widest">Network</p>
                       <p className="text-sm font-black text-white">Active</p>
                    </div>
                 </div>
                 <div className="flex-1 bg-white/5 p-6 rounded-[2.5rem] border border-white/10 flex items-center gap-4 hover:bg-white/10 transition-colors">
                    <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center">
                       <Server size={22} />
                    </div>
                    <div>
                       <p className="text-[8px] font-black text-[#A179FF] uppercase tracking-widest">Uptime</p>
                       <p className="text-sm font-black text-white">99.9%</p>
                    </div>
                 </div>
              </div>
           )}
        </div>
      )}

      {/* Profile Identity Card Section */}
      <div className="relative pt-20 px-1">
        <div className="bg-white rounded-[4.5rem] p-10 pt-28 shadow-[0_30px_70px_-20px_rgba(46,11,94,0.2)] border border-slate-50 relative text-center overflow-hidden">
          
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-20">
            <div className="relative">
              <div className="absolute inset-[-15px] bg-gradient-to-br from-[#8D30F4] to-[#A179FF] rounded-full opacity-10 blur-2xl"></div>
              
              <div className="w-40 h-40 bg-white p-2.5 rounded-full shadow-2xl border-[12px] border-slate-50 flex items-center justify-center overflow-hidden">
                {logoUrl ? (
                  <img src={logoUrl} className="w-full h-full object-cover rounded-full" alt="Profile" />
                ) : (
                  <div className="w-full h-full bg-[#F2EBFF] flex items-center justify-center text-[#8D30F4]">
                    <UserIcon size={70} strokeWidth={1.5} />
                  </div>
                )}
              </div>
              
              {!isTeacher && (
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="absolute bottom-1 right-2 w-12 h-12 bg-[#8D30F4] text-white rounded-2xl flex items-center justify-center shadow-xl border-4 border-white active:scale-90 transition-all hover:rotate-12"
                >
                  <Camera size={22} />
                </button>
              )}
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
            </div>
          </div>

          <div className="space-y-6">
             <div className="space-y-3">
                <h2 className="text-[28px] sm:text-[34px] font-black text-[#2E0B5E] font-noto tracking-tight leading-tight px-4 overflow-hidden text-ellipsis">
                  {madrasah.name}
                </h2>
                
                {/* Sender ID Display Section */}
                <div className="flex flex-col items-center gap-2">
                   <div className="inline-flex px-6 py-2 bg-[#F2EBFF] text-[#8D30F4] rounded-2xl border border-[#8D30F4]/10 shadow-sm">
                      <div className="flex items-center gap-2.5">
                         <ShieldCheck size={14} className="text-[#8D30F4]" />
                         <span className="text-[11px] font-black uppercase tracking-[0.1em]">{t('sender_id', lang)}:</span>
                         <span className="text-[12px] font-black tracking-tight">{madrasah.reve_caller_id || 'DEFAULT'}</span>
                      </div>
                   </div>
                   <div className="inline-flex px-6 py-2.5 bg-[#F2F5FF] text-[#A179FF] rounded-full text-[10px] font-black uppercase tracking-[0.3em] font-noto">
                     {isTeacher ? t('teacher_portal', lang) : t('admin_portal', lang)}
                   </div>
                </div>
             </div>
             
             <div className="pt-4">
                <div 
                  onClick={() => copyToClipboard(madrasah.id)}
                  className="bg-slate-50/70 p-5 rounded-[2.5rem] border border-slate-100 flex items-center gap-5 active:scale-[0.98] transition-all cursor-pointer hover:bg-white group/uuid"
                >
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[#8D30F4] shadow-sm border border-slate-50">
                     <Fingerprint size={24} />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">{t('madrasah_uuid', lang)}</p>
                    <p className="text-[12px] font-black text-[#8D30F4] tracking-tight truncate">
                      {madrasah.id}
                    </p>
                  </div>
                  <div className="w-10 h-10 flex items-center justify-center text-slate-200 group-hover/uuid:text-[#8D30F4] transition-colors">
                    {copiedId ? <Check size={22} className="text-green-500" /> : <Copy size={20} />}
                  </div>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4 mt-8 pt-4">
                <StatCard icon={Users} value={stats.students} label={t('students', lang)} colorClass="bg-purple-600" delay="duration-300" />
                <StatCard icon={Layers} value={stats.classes} label={t('classes', lang)} colorClass="bg-blue-600" delay="duration-500" />
                <StatCard icon={GraduationCap} value={stats.teachers} label={t('teachers', lang)} colorClass="bg-emerald-600" delay="duration-700" />
                <StatCard icon={Zap} value={madrasah.sms_balance || 0} label={t('wallet', lang)} colorClass="bg-amber-600" delay="duration-1000" />
             </div>
          </div>
        </div>
      </div>

      {!isTeacher && !isSuperAdmin && (
        <div className="space-y-6 px-1">
           <div className="px-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <Box size={16} className="text-white opacity-60" />
                 <h4 className="text-[11px] font-black text-white uppercase tracking-[0.35em] opacity-80">Management Core</h4>
              </div>
              <Sparkles size={14} className="text-white opacity-40" />
           </div>
           <div className="grid grid-cols-2 gap-5">
              <BentoAction 
                icon={UserPlus} 
                title={t('manage_teachers', lang)} 
                desc="Access Controls" 
                onClick={() => setView('teachers')} 
                theme="bg-gradient-to-br from-[#8D30F4] to-[#A179FF]" 
              />
              <BentoAction 
                icon={Database} 
                title={t('backup_restore', lang)} 
                desc="Backup Hub" 
                onClick={() => setView('data-management')} 
                theme="bg-gradient-to-br from-indigo-500 to-indigo-700" 
              />
           </div>
        </div>
      )}

      <div className="bg-white rounded-[3.5rem] shadow-2xl border border-slate-50 divide-y divide-slate-50 overflow-hidden mx-1">
        {!isTeacher && (
          <button onClick={() => setIsEditingProfile(true)} className="w-full p-8 flex items-center justify-between group active:bg-slate-50 transition-all">
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-purple-50 text-[#8D30F4] rounded-2xl flex items-center justify-center border border-purple-100 group-hover:scale-110 transition-transform">
                <Edit3 size={22} />
              </div>
              <div className="text-left">
                <h5 className="text-[17px] font-black text-[#2E0B5E] font-noto">{t('profile_settings', lang)}</h5>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{t('branding', lang)}</p>
              </div>
            </div>
            <ChevronRight size={22} className="text-slate-200 group-hover:text-[#8D30F4] transition-all" />
          </button>
        )}

        <div className="w-full p-8 flex items-center justify-between group">
          <div className="flex items-center gap-6">
            <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center border border-blue-100">
              <Languages size={22} />
            </div>
            <div className="text-left">
              <h5 className="text-[17px] font-black text-[#2E0B5E] font-noto">{t('language', lang)}</h5>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{t('change_lang', lang)}</p>
            </div>
          </div>
          <div className="flex p-1.5 bg-slate-50 rounded-2xl border border-slate-100">
            <button onClick={() => setLang('bn')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black transition-all ${lang === 'bn' ? 'bg-white text-[#8D30F4] shadow-sm' : 'text-slate-400'}`}>বাংলা</button>
            <button onClick={() => setLang('en')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black transition-all ${lang === 'en' ? 'bg-white text-[#8D30F4] shadow-sm' : 'text-slate-400'}`}>ENG</button>
          </div>
        </div>

        <button onClick={onLogout} className="w-full p-8 flex items-center justify-between group active:bg-red-50 transition-all">
          <div className="flex items-center gap-6">
            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center border border-red-100 group-hover:scale-110 transition-transform">
              <LogOut size={22} />
            </div>
            <div className="text-left">
              <h5 className="text-[17px] font-black text-red-600 font-noto">{t('logout', lang)}</h5>
              <p className="text-[10px] font-bold text-red-300 uppercase tracking-widest mt-1">{t('logout_system', lang)}</p>
            </div>
          </div>
          <ChevronRight size={22} className="text-red-100 group-hover:text-red-500 transition-all" />
        </button>
      </div>

      {isEditingProfile && (
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-[#080A12]/80 backdrop-blur-2xl z-[1000] flex items-center justify-center p-4 m-0 overflow-hidden">
           <div className="bg-white w-full max-w-sm rounded-[4rem] p-8 shadow-2xl space-y-8 animate-in zoom-in-95 duration-500 relative max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-50 text-[#8D30F4] rounded-2xl flex items-center justify-center shadow-inner">
                    <Edit3 size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-[#2E0B5E] font-noto tracking-tight">{t('edit_account_info', lang)}</h3>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Profile Metadata</p>
                  </div>
                </div>
                <button onClick={() => setIsEditingProfile(false)} className="w-9 h-9 bg-slate-50 text-slate-400 hover:text-red-500 transition-colors rounded-xl flex items-center justify-center"><X size={20} /></button>
              </div>

              <div className="space-y-5">
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">{t('madrasah_name', lang)}</label>
                    <input type="text" className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 font-black text-[#2E0B5E] text-base outline-none focus:border-[#8D30F4]/30" value={newName} onChange={(e) => setNewName(e.target.value)} />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">{t('madrasah_phone', lang)}</label>
                    <input type="tel" className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 font-black text-[#2E0B5E] text-base outline-none focus:border-[#8D30F4]/30" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">{t('madrasah_code_label', lang)}</label>
                    <input type="text" className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 font-black text-[#2E0B5E] text-base outline-none focus:border-[#8D30F4]/30" value={newLoginCode} onChange={(e) => setNewLoginCode(e.target.value)} />
                 </div>
              </div>

              <div className="flex gap-3 pt-2 shrink-0">
                 <button onClick={() => setIsEditingProfile(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-2xl text-xs active:scale-95 transition-all">{t('cancel_btn', lang)}</button>
                 <button onClick={handleUpdate} disabled={saving} className="flex-[2] py-4 bg-[#8D30F4] text-white font-black rounded-2xl text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                    {saving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={18} /> {t('save_changes', lang)}</>}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Success Modal - Fixed positioning to avoid clipping */}
      {showSuccessModal && (
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 bg-[#080A12]/60 backdrop-blur-2xl z-[2000] flex items-center justify-center p-6 m-0 overflow-hidden">
          <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-10 text-center shadow-[0_40px_100px_rgba(141,48,244,0.3)] border border-[#8D30F4]/10 animate-in zoom-in-95 duration-300 max-h-[85vh] overflow-y-auto custom-scrollbar">
             <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-green-100">
                <CheckCircle2 size={48} strokeWidth={2.5} />
             </div>
             <h3 className="text-xl font-black text-slate-800 font-noto tracking-tight">{t('success', lang)}</h3>
             <p className="text-[10px] font-bold text-slate-400 mt-3 uppercase tracking-[0.2em] font-noto">Profile updated successfully</p>
             <button 
               onClick={() => setShowSuccessModal(false)} 
               className="w-full mt-8 py-4 premium-btn text-white font-black rounded-full shadow-xl active:scale-95 transition-all text-sm uppercase tracking-widest"
             >
               {lang === 'bn' ? 'ঠিক আছে' : 'OK'}
             </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Account;
