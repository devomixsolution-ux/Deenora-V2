
import React, { useState, useRef, useEffect } from 'react';
import { LogOut, Camera, Loader2, User as UserIcon, ShieldCheck, Database, ChevronRight, Check, MessageSquare, Zap, Globe, Smartphone, Save, Users, Layers, Edit3, UserPlus, Languages, Mail, Key, Settings, Fingerprint, Copy, History, Server, CreditCard, Shield, Sliders, Activity, Bell, RefreshCw, AlertTriangle, GraduationCap, ChevronLeft, ArrowRight, LayoutDashboard, Settings2, X, Sparkles, Box, Tool } from 'lucide-react';
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

      alert(lang === 'bn' ? 'সব তথ্য আপডেট হয়েছে!' : 'Profile Updated!');
    } catch (err: any) { 
      alert(lang === 'bn' ? `এরর: ${err.message}` : `Error: ${err.message}`);
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
        <h3 className="text-2xl font-black font-noto mb-4">প্রোফাইল পাওয়া যায়নি!</h3>
        <button onClick={onLogout} className="w-full py-5 bg-white text-red-600 font-black rounded-full shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3">
          <LogOut size={22} /> লগ আউট করুন
        </button>
      </div>
    );
  }

  const StatCard = ({ icon: Icon, value, label, colorClass, delay }: { icon: any, value: number | string, label: string, colorClass: string, delay: string }) => (
    <div className={`bg-white/95 rounded-[2.5rem] p-5 border border-white/50 shadow-xl flex flex-col items-center text-center relative overflow-hidden group animate-in slide-in-from-bottom-4 ${delay}`}>
      <div className={`absolute -right-4 -top-4 w-16 h-16 rounded-full opacity-5 group-hover:scale-150 transition-transform duration-700 ${colorClass}`}></div>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 shadow-inner border border-white/40 ${colorClass} bg-opacity-10`}>
        <Icon size={24} className={colorClass.replace('bg-', 'text-')} />
      </div>
      <div className="space-y-1">
        <h4 className="text-2xl font-black text-[#2E0B5E] tracking-tight leading-none">
          {loadingStats ? <Loader2 className="animate-spin text-slate-200" size={16} /> : value}
        </h4>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{label}</p>
      </div>
    </div>
  );

  const BentoAction = ({ icon: Icon, title, desc, onClick, theme }: { icon: any, title: string, desc: string, onClick: () => void, theme: string }) => (
    <button 
      onClick={onClick} 
      className={`relative overflow-hidden bg-white rounded-[2.8rem] p-6 shadow-2xl border border-white active:scale-[0.97] transition-all hover:bg-slate-50 flex flex-col gap-6 text-left group h-full`}
    >
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:rotate-12 ${theme}`}>
        <Icon size={28} className="text-white" />
      </div>
      <div className="flex-1">
        <h5 className="text-[17px] font-black text-[#2E0B5E] font-noto leading-tight">{title}</h5>
        <p className="text-[10px] font-bold text-slate-400 mt-1.5 uppercase tracking-wider">{desc}</p>
      </div>
      <div className="flex justify-end">
        <div className="w-9 h-9 rounded-full bg-slate-50 text-slate-300 flex items-center justify-center group-hover:bg-[#8D30F4] group-hover:text-white transition-all shadow-sm">
          <ArrowRight size={18} />
        </div>
      </div>
    </button>
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-36">
      
      {/* Super Admin Command Center */}
      {isSuperAdmin && (
        <div className="bg-[#1A0B2E] p-8 rounded-[3.5rem] border border-white/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.4)] space-y-8 relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform duration-1000">
              <Shield size={140} className="text-[#A179FF]" />
           </div>
           
           <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-5">
                 <div className="w-14 h-14 bg-[#8D30F4] text-white rounded-[1.5rem] flex items-center justify-center shadow-[0_0_40px_rgba(141,48,244,0.5)] border border-white/10">
                    <LayoutDashboard size={26} />
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-white font-noto tracking-tight">System Core</h3>
                    <p className="text-[9px] font-black text-[#A179FF] uppercase tracking-[0.25em] mt-1.5">Master Controller Panel</p>
                 </div>
              </div>
              <button 
                onClick={() => setIsEditingGlobal(!isEditingGlobal)} 
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg border border-white/10 ${isEditingGlobal ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
              >
                {isEditingGlobal ? <X size={22} /> : <Settings2 size={22} />}
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
                       <label className="text-[9px] font-black text-[#A179FF] uppercase tracking-widest block mb-2.5">Secret Identity</label>
                       <input type="text" className="bg-transparent border-none outline-none font-black text-white text-sm w-full placeholder:text-white/20" value={globalSettings.reve_secret_key} onChange={(e) => setGlobalSettings({...globalSettings, reve_secret_key: e.target.value})} placeholder="Enter Secret..." />
                    </div>
                 </div>
                 <button onClick={handleSaveGlobalSettings} disabled={saving} className="w-full py-5 bg-[#8D30F4] text-white font-black rounded-[2rem] text-sm shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 border border-white/10">
                    {saving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> Deploy Global System Update</>}
                 </button>
              </div>
           ) : (
              <div className="flex gap-4 relative z-10">
                 <div className="flex-1 bg-white/5 p-6 rounded-[2.2rem] border border-white/10 flex items-center gap-4 group/box transition-all hover:bg-white/10">
                    <div className="w-12 h-12 bg-green-500/20 text-green-400 rounded-2xl flex items-center justify-center shadow-inner group-hover/box:scale-110 transition-transform">
                       <Activity size={22} />
                    </div>
                    <div>
                       <p className="text-[8px] font-black text-[#A179FF] uppercase tracking-widest leading-none mb-1">Status</p>
                       <p className="text-sm font-black text-white">Cloud Active</p>
                    </div>
                 </div>
                 <div className="flex-1 bg-white/5 p-6 rounded-[2.2rem] border border-white/10 flex items-center gap-4 group/box transition-all hover:bg-white/10">
                    <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center shadow-inner group-hover/box:scale-110 transition-transform">
                       <Server size={22} />
                    </div>
                    <div>
                       <p className="text-[8px] font-black text-[#A179FF] uppercase tracking-widest leading-none mb-1">Protocol</p>
                       <p className="text-sm font-black text-white">SMPP Connected</p>
                    </div>
                 </div>
              </div>
           )}
        </div>
      )}

      {/* Floating Identity Card */}
      <div className="relative pt-12">
        <div className="bg-white/95 rounded-[3.5rem] p-10 pt-20 shadow-[0_30px_80px_-15px_rgba(46,11,94,0.15)] border border-white relative">
          
          {/* Glowing Avatar */}
          <div className="absolute -top-14 left-1/2 -translate-x-1/2 z-20 group/avatar">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-[#8D30F4] to-[#A179FF] rounded-[3.8rem] blur-2xl opacity-20 group-hover/avatar:opacity-40 transition-opacity"></div>
              <div className="w-36 h-36 bg-white p-1.5 rounded-[3.8rem] shadow-2xl border-[10px] border-slate-50 flex items-center justify-center overflow-hidden transition-transform duration-700 hover:rotate-6">
                {logoUrl ? <img src={logoUrl} className="w-full h-full object-cover rounded-[3rem]" alt="Logo" /> : isSuperAdmin ? <ShieldCheck size={65} className="text-[#8D30F4]" /> : <UserIcon size={60} className="text-[#8D30F4]" />}
              </div>
              {!isTeacher && (
                <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-1 right-1 w-12 h-12 bg-[#8D30F4] text-white rounded-2xl flex items-center justify-center shadow-xl border-4 border-white active:scale-90 transition-all hover:rotate-12">
                  <Camera size={22} />
                </button>
              )}
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
            </div>
          </div>

          <div className="text-center space-y-4">
             <div className="space-y-1">
                <h2 className="text-3xl font-black text-[#2E0B5E] font-noto tracking-tight leading-tight">{madrasah.name}</h2>
                <div className="flex items-center justify-center gap-2">
                   {isTeacher ? (
                     <div className="inline-flex px-5 py-1.5 bg-[#8D30F4] rounded-full text-[9px] font-black text-white uppercase tracking-[0.3em] shadow-lg border border-white/20">Authorized Teacher</div>
                   ) : (
                     <div className="inline-flex px-5 py-1.5 bg-slate-100 rounded-full text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] border border-slate-50">Portal Admin</div>
                   )}
                </div>
             </div>
             
             <div className="flex justify-center pt-2">
                <div 
                  onClick={() => copyToClipboard(madrasah.id)}
                  className="bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100 flex items-center gap-4 active:scale-95 transition-all cursor-pointer hover:bg-white hover:border-[#8D30F4]/30 group/uuid"
                >
                  <Fingerprint size={18} className="text-[#8D30F4]" />
                  <div className="flex flex-col items-start min-w-0">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Digital Certificate UUID</p>
                    <p className="text-[12px] font-black text-[#8D30F4] tracking-tight truncate max-w-[160px]">
                      {madrasah.id}
                    </p>
                  </div>
                  {copiedId ? <Check size={16} className="text-green-500" /> : <Copy size={16} className="text-slate-300 group-hover/uuid:text-[#8D30F4] transition-colors" />}
                </div>
             </div>
          </div>

          {/* Bento Statistics Grid */}
          <div className="grid grid-cols-2 gap-4 mt-12">
             <StatCard icon={Users} value={stats.students} label={t('students', lang)} colorClass="bg-purple-600" delay="duration-300" />
             <StatCard icon={Layers} value={stats.classes} label={t('classes', lang)} colorClass="bg-blue-600" delay="duration-500" />
             <StatCard icon={GraduationCap} value={stats.teachers} label={t('teachers', lang)} colorClass="bg-emerald-600" delay="duration-700" />
             <StatCard icon={Zap} value={madrasah.sms_balance || 0} label="SMS Remaining" colorClass="bg-amber-600" delay="duration-1000" />
          </div>
        </div>
      </div>

      {/* Quick Action Bento Grid */}
      {!isTeacher && !isSuperAdmin && (
        <div className="space-y-6">
           <div className="px-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <Box size={16} className="text-white opacity-60" />
                 <h4 className="text-[11px] font-black text-white uppercase tracking-[0.35em] opacity-80 drop-shadow-md">Core Modules</h4>
              </div>
              <Sparkles size={14} className="text-white opacity-40 animate-pulse" />
           </div>
           <div className="grid grid-cols-2 gap-5 px-1">
              <BentoAction 
                icon={UserPlus} 
                title="Manage Staff" 
                desc="Access Controls" 
                onClick={() => setView('teachers')} 
                theme="bg-gradient-to-br from-indigo-500 to-blue-600" 
              />
              <BentoAction 
                icon={Database} 
                title="Data Hub" 
                desc="Export & Import" 
                onClick={() => setView('data-management')} 
                theme="bg-gradient-to-br from-purple-500 to-[#8D30F4]" 
              />
           </div>
        </div>
      )}

      {/* Account Settings Terminal */}
      <div className="bg-white/95 rounded-[3.5rem] shadow-2xl border border-white divide-y divide-slate-50 overflow-hidden">
        {!isTeacher && (
          <button onClick={() => setIsEditingProfile(true)} className="w-full p-7 flex items-center justify-between group active:bg-slate-50 transition-all">
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-purple-50 text-[#8D30F4] rounded-2xl flex items-center justify-center border border-purple-100 shadow-inner group-hover:scale-110 transition-transform">
                <Edit3 size={22} />
              </div>
              <div className="text-left">
                <h5 className="text-[16px] font-black text-[#2E0B5E] font-noto">Profile Configuration</h5>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Identity & Branding</p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 group-hover:text-[#8D30F4] transition-all">
              <ChevronRight size={22} />
            </div>
          </button>
        )}

        <div className="w-full p-7 flex items-center justify-between group">
          <div className="flex items-center gap-6">
            <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center border border-blue-100 shadow-inner group-hover:scale-110 transition-transform">
              <Languages size={22} />
            </div>
            <div className="text-left">
              <h5 className="text-[16px] font-black text-[#2E0B5E] font-noto">Localization</h5>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Language Preferences</p>
            </div>
          </div>
          <div className="flex p-1.5 bg-slate-100 rounded-2xl shadow-inner">
            <button onClick={() => setLang('bn')} className={`px-5 py-2 rounded-xl text-[10px] font-black transition-all ${lang === 'bn' ? 'bg-white text-[#8D30F4] shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>বাংলা</button>
            <button onClick={() => setLang('en')} className={`px-5 py-2 rounded-xl text-[10px] font-black transition-all ${lang === 'en' ? 'bg-white text-[#8D30F4] shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>ENG</button>
          </div>
        </div>

        <button onClick={onLogout} className="w-full p-7 flex items-center justify-between group active:bg-red-50 transition-all">
          <div className="flex items-center gap-6">
            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center border border-red-100 shadow-inner group-hover:scale-110 transition-transform">
              <LogOut size={22} />
            </div>
            <div className="text-left">
              <h5 className="text-[16px] font-black text-red-600 font-noto">Terminate Session</h5>
              <p className="text-[9px] font-bold text-red-300 uppercase tracking-widest mt-1">Exit Digital Portal</p>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-red-200 group-hover:text-red-500 transition-all">
            <ChevronRight size={22} />
          </div>
        </button>
      </div>

      {/* Edit Profile Modal */}
      {isEditingProfile && (
        <div className="fixed inset-0 bg-[#080A12]/80 backdrop-blur-2xl z-[600] flex items-center justify-center p-6 animate-in fade-in">
           <div className="bg-white w-full max-w-sm rounded-[3.8rem] p-10 shadow-2xl space-y-10 animate-in zoom-in-95 duration-500 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#8D30F4] to-[#A179FF]"></div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-purple-100 text-[#8D30F4] rounded-[1.2rem] flex items-center justify-center shadow-inner">
                    <Edit3 size={26} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-[#2E0B5E] font-noto tracking-tight">তথ্য সংশোধন</h3>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Profile Metadata</p>
                  </div>
                </div>
                <button onClick={() => setIsEditingProfile(false)} className="w-10 h-10 bg-slate-50 text-slate-300 hover:text-red-500 transition-colors rounded-xl flex items-center justify-center"><X size={24} /></button>
              </div>

              <div className="space-y-6">
                 <div className="space-y-2.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Organization Name</label>
                    <input type="text" className="w-full h-16 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] px-6 font-black text-[#2E0B5E] text-lg outline-none focus:border-[#8D30F4]/30 transition-all" value={newName} onChange={(e) => setNewName(e.target.value)} />
                 </div>
                 <div className="space-y-2.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Contact Link (Phone)</label>
                    <input type="tel" className="w-full h-16 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] px-6 font-black text-[#2E0B5E] text-lg outline-none focus:border-[#8D30F4]/30 transition-all" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                 </div>
              </div>

              <div className="flex gap-4 pt-4">
                 <button onClick={() => setIsEditingProfile(false)} className="flex-1 py-5 bg-slate-100 text-slate-500 font-black rounded-3xl text-sm active:scale-95 transition-all">Cancel</button>
                 <button onClick={handleUpdate} disabled={saving} className="flex-[2] py-5 bg-[#8D30F4] text-white font-black rounded-3xl text-sm shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 border border-white/20">
                    {saving ? <Loader2 className="animate-spin" size={24} /> : <><Save size={24} /> Sync Update</>}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Account;
