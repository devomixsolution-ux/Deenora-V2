
import React, { useState, useRef, useEffect } from 'react';
import { LogOut, Camera, Loader2, User as UserIcon, ShieldCheck, Database, ChevronRight, Check, MessageSquare, Zap, Globe, Smartphone, Save, Users, Layers, Edit3, UserPlus, Languages, Mail, Key, Settings, Fingerprint, Copy, History, Server, CreditCard, Shield, Sliders, Activity, Bell } from 'lucide-react';
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

  // Profile Edit States
  const [newName, setNewName] = useState(initialMadrasah?.name || '');
  const [newPhone, setNewPhone] = useState(initialMadrasah?.phone || '');
  const [newLoginCode, setNewLoginCode] = useState(initialMadrasah?.login_code || '');
  const [logoUrl, setLogoUrl] = useState(initialMadrasah?.logo_url || '');
  
  // Madrasah Specific Gateway Settings
  const [reveApiKey, setReveApiKey] = useState(initialMadrasah?.reve_api_key || '');
  const [reveSecretKey, setReveSecretKey] = useState(initialMadrasah?.reve_secret_key || '');
  const [reveCallerId, setReveCallerId] = useState(initialMadrasah?.reve_caller_id || '');

  // Global System Settings (For Super Admin)
  const [globalSettings, setGlobalSettings] = useState({
    reve_api_key: '',
    reve_secret_key: '',
    reve_caller_id: '',
    bkash_number: ''
  });
  
  const [copiedId, setCopiedId] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialMadrasah?.id) {
      fetchStats();
      if (isSuperAdmin) {
        fetchGlobalSettings();
      }
    }
  }, [initialMadrasah?.id, isSuperAdmin]);

  const fetchStats = async () => {
    if (!initialMadrasah) return;
    setLoadingStats(true);
    try {
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

  if (!madrasah) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-28">
      {/* GLOBAL SYSTEM SETTINGS - FOR SUPER ADMIN (TOP) */}
      {isSuperAdmin && (
        <div className="bg-white/95 backdrop-blur-3xl p-8 rounded-[3.5rem] border border-white/50 shadow-[0_25px_60px_-15px_rgba(46,11,94,0.1)] space-y-8 relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:rotate-12 transition-transform duration-700">
              <Sliders size={120} />
           </div>

           <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-4">
                 <div className="w-14 h-14 bg-indigo-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-[0_10px_25px_-5px_rgba(79,70,229,0.4)]">
                    <Settings size={26} />
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-[#2E0B5E] font-noto tracking-tight">Super Control Center</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">System-wide Gateway Config</p>
                 </div>
              </div>
              {!isEditingGlobal && (
                <button onClick={() => setIsEditingGlobal(true)} className="w-11 h-11 bg-slate-50 text-indigo-600 rounded-2xl flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all duration-300 border border-slate-100 shadow-sm active:scale-90">
                  <Edit3 size={18} />
                </button>
              )}
           </div>

           {isEditingGlobal ? (
              <div className="space-y-8 animate-in slide-in-from-top-4 duration-500 relative z-10">
                 <div className="space-y-5">
                    <div className="flex items-center gap-2.5 px-1 mb-2">
                       <Server size={14} className="text-indigo-600" />
                       <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Global SMS (REVE)</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="bg-slate-50/80 p-5 rounded-2xl border-2 border-transparent focus-within:border-indigo-600/30 transition-all shadow-inner">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Global API Key</label>
                          <div className="flex items-center gap-3">
                             <Key size={14} className="text-slate-300" />
                             <input type="text" className="bg-transparent border-none outline-none font-black text-[#2E0B5E] text-sm w-full" value={globalSettings.reve_api_key} onChange={(e) => setGlobalSettings({...globalSettings, reve_api_key: e.target.value})} placeholder="API Key" />
                          </div>
                       </div>
                       <div className="bg-slate-50/80 p-5 rounded-2xl border-2 border-transparent focus-within:border-indigo-600/30 transition-all shadow-inner">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Global Secret Key</label>
                          <div className="flex items-center gap-3">
                             <Shield size={14} className="text-slate-300" />
                             <input type="text" className="bg-transparent border-none outline-none font-black text-[#2E0B5E] text-sm w-full" value={globalSettings.reve_secret_key} onChange={(e) => setGlobalSettings({...globalSettings, reve_secret_key: e.target.value})} placeholder="Secret Key" />
                          </div>
                       </div>
                    </div>
                    <div className="bg-slate-50/80 p-5 rounded-2xl border-2 border-transparent focus-within:border-indigo-600/30 transition-all shadow-inner">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Global Sender ID</label>
                       <input type="text" className="bg-transparent border-none outline-none font-black text-[#2E0B5E] text-sm w-full" value={globalSettings.reve_caller_id} onChange={(e) => setGlobalSettings({...globalSettings, reve_caller_id: e.target.value})} placeholder="e.g. Madrasah" />
                    </div>
                 </div>

                 <div className="space-y-5">
                    <div className="flex items-center gap-2.5 px-1 mb-2">
                       <CreditCard size={14} className="text-pink-500" />
                       <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Payment Configuration</h4>
                    </div>
                    <div className="bg-slate-50/80 p-5 rounded-3xl border-2 border-transparent focus-within:border-indigo-600/30 transition-all shadow-inner">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Official bKash Number</label>
                       <div className="flex items-center gap-3">
                          <Smartphone size={18} className="text-pink-500" />
                          <input type="text" className="bg-transparent border-none outline-none font-black text-[#2E0B5E] text-lg w-full font-noto" value={globalSettings.bkash_number} onChange={(e) => setGlobalSettings({...globalSettings, bkash_number: e.target.value})} placeholder="০১৭XXXXXXXX" />
                       </div>
                    </div>
                 </div>

                 <div className="flex gap-4 pt-4">
                    <button onClick={() => setIsEditingGlobal(false)} className="flex-1 py-5 bg-slate-100 text-slate-500 font-black rounded-[1.8rem] text-sm transition-all hover:bg-slate-200 active:scale-95">Cancel</button>
                    <button onClick={handleSaveGlobalSettings} disabled={saving} className="flex-[2] py-5 bg-indigo-600 text-white font-black rounded-[1.8rem] text-sm shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 active:scale-95 transition-all">
                       {saving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> Deploy Global Config</>}
                    </button>
                 </div>
              </div>
           ) : (
              <div className="space-y-6 animate-in fade-in duration-500 relative z-10">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50/80 p-6 rounded-3xl border border-slate-100">
                       <div className="flex items-center gap-2 mb-3">
                          <Activity size={12} className="text-green-500" />
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Gateway Status</p>
                       </div>
                       <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-sm font-black text-slate-800">Operational</span>
                       </div>
                    </div>
                    <div className="bg-slate-50/80 p-6 rounded-3xl border border-slate-100">
                       <div className="flex items-center gap-2 mb-3">
                          <Bell size={12} className="text-indigo-600" />
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Active Sender</p>
                       </div>
                       <p className="text-sm font-black text-slate-800">{globalSettings.reve_caller_id || 'Not Set'}</p>
                    </div>
                 </div>

                 <div className="bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100/50 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
                          <Smartphone size={20} />
                       </div>
                       <div>
                          <p className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-0.5">Payment Support</p>
                          <p className="text-base font-black text-indigo-900 font-noto">{globalSettings.bkash_number || 'None'}</p>
                       </div>
                    </div>
                    <div className="px-3 py-1 bg-white rounded-lg text-[9px] font-black text-indigo-600 uppercase border border-indigo-100">Primary</div>
                 </div>
              </div>
           )}
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-white/95 backdrop-blur-3xl p-10 rounded-[3.5rem] border border-white/50 shadow-[0_25px_60px_-15px_rgba(46,11,94,0.1)] space-y-10 relative overflow-hidden group">
        <div className="flex flex-col items-center gap-8 relative z-10">
          <div className="relative group/photo">
            <div className="w-32 h-32 bg-white rounded-[2.8rem] border-[6px] border-slate-50 shadow-2xl flex items-center justify-center overflow-hidden transition-transform duration-500 group-hover/photo:scale-105">
               {logoUrl ? <img src={logoUrl} className="w-full h-full object-cover" alt="Logo" /> : isSuperAdmin ? <ShieldCheck size={50} className="text-indigo-600" /> : <UserIcon size={45} className="text-[#8D30F4]" />}
            </div>
            {isEditingProfile && !isTeacher && (
              <button onClick={() => fileInputRef.current?.click()} className="absolute -bottom-2 -right-2 w-11 h-11 bg-[#8D30F4] text-white rounded-2xl flex items-center justify-center shadow-lg border-4 border-white active:scale-90 transition-all">
                <Camera size={20} />
              </button>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
          </div>

          <div className="text-center w-full space-y-4">
            <div>
               <h2 className="text-3xl font-black text-[#2E0B5E] font-noto tracking-tight leading-tight">{madrasah.name}</h2>
               {isTeacher && <div className="mt-2 inline-flex px-4 py-1 bg-[#8D30F4] rounded-full text-[9px] font-black text-white uppercase tracking-[0.3em]">Teacher Mode</div>}
            </div>
            
            <div className="flex justify-center">
              <div 
                onClick={() => copyToClipboard(madrasah.id)}
                className="bg-slate-50/80 px-6 py-3 rounded-2xl border border-slate-100 flex items-center gap-4 active:scale-95 transition-all cursor-pointer hover:bg-white hover:border-[#8D30F4]/20 group/uuid"
              >
                <Fingerprint size={18} className="text-[#8D30F4]" />
                <div className="flex flex-col items-start min-w-0">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Identity UUID</p>
                  <p className="text-[12px] font-black text-[#8D30F4] tracking-tight truncate max-w-[140px]">
                    {madrasah.id}
                  </p>
                </div>
                {copiedId ? <Check size={16} className="text-green-500" /> : <Copy size={16} className="text-slate-300 group-hover/uuid:text-[#8D30F4]" />}
              </div>
            </div>
          </div>
        </div>

        {/* Info & Edit Area */}
        <div className="space-y-6 relative z-10 pt-4">
          {isEditingProfile && !isTeacher ? (
            <div className="space-y-5 animate-in slide-in-from-top-4 duration-500">
              <div className="bg-slate-50/80 p-6 rounded-3xl border-2 border-transparent focus-within:border-[#8D30F4]/30 transition-all shadow-inner group/input">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Organization Name</label>
                <div className="flex items-center gap-3">
                   <Globe size={18} className="text-slate-300 group-focus-within/input:text-[#8D30F4] transition-colors" />
                   <input type="text" className="bg-transparent border-none outline-none font-black text-[#2E0B5E] text-base w-full font-noto" value={newName} onChange={(e) => setNewName(e.target.value)} />
                </div>
              </div>
              <div className="bg-slate-50/80 p-6 rounded-3xl border-2 border-transparent focus-within:border-[#8D30F4]/30 transition-all shadow-inner group/input">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Contact Phone</label>
                <div className="flex items-center gap-3">
                   <Smartphone size={18} className="text-slate-300 group-focus-within/input:text-[#8D30F4] transition-colors" />
                   <input type="tel" className="bg-transparent border-none outline-none font-black text-[#2E0B5E] text-base w-full" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                </div>
              </div>
              <div className="bg-slate-50/80 p-6 rounded-3xl border-2 border-transparent focus-within:border-[#8D30F4]/30 transition-all shadow-inner group/input">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Secure Login Code</label>
                <div className="flex items-center gap-3">
                   <Key size={18} className="text-[#8D30F4]" />
                   <input type="text" className="bg-transparent border-none outline-none font-black text-[#8D30F4] text-lg w-full tracking-widest" value={newLoginCode} onChange={(e) => setNewLoginCode(e.target.value)} />
                </div>
              </div>

              {!isSuperAdmin && (
                <div className="pt-6 border-t border-slate-100 space-y-6">
                  <div className="flex items-center gap-2.5 px-1 mb-2">
                     <Server size={14} className="text-[#8D30F4]" />
                     <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Individual SMS Masking</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50/80 p-5 rounded-2xl border-2 border-transparent focus-within:border-[#8D30F4]/30 transition-all shadow-inner">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">API Key</label>
                        <input type="text" className="bg-transparent border-none outline-none font-black text-[#2E0B5E] text-xs w-full" value={reveApiKey} onChange={(e) => setReveApiKey(e.target.value)} placeholder="Reve API Key" />
                      </div>
                      <div className="bg-slate-50/80 p-5 rounded-2xl border-2 border-transparent focus-within:border-[#8D30F4]/30 transition-all shadow-inner">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Secret Key</label>
                        <input type="text" className="bg-transparent border-none outline-none font-black text-[#2E0B5E] text-xs w-full" value={reveSecretKey} onChange={(e) => setReveSecretKey(e.target.value)} placeholder="Secret Key" />
                      </div>
                  </div>
                  <div className="bg-slate-50/80 p-5 rounded-2xl border-2 border-transparent focus-within:border-[#8D30F4]/30 transition-all shadow-inner">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Masking ID</label>
                    <input type="text" className="bg-transparent border-none outline-none font-black text-[#2E0B5E] text-xs w-full" value={reveCallerId} onChange={(e) => setReveCallerId(e.target.value)} placeholder="Sender Name" />
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-6">
                <button onClick={() => setIsEditingProfile(false)} className="flex-1 py-5 bg-slate-100 text-slate-500 font-black rounded-3xl text-sm transition-all active:scale-95">Cancel</button>
                <button onClick={handleUpdate} disabled={saving} className="flex-[2] py-5 bg-[#8D30F4] text-white font-black rounded-3xl text-sm shadow-[0_15px_30px_-5px_rgba(141,48,244,0.3)] flex items-center justify-center gap-3 active:scale-95 transition-all">
                  {saving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> Save Changes</>}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-500">
              {!isTeacher && (
                <>
                  {!isSuperAdmin && (
                    <div className="grid grid-cols-1 gap-4 mb-6">
                      <button onClick={() => setView('teachers')} className="group flex items-center justify-between p-6 bg-slate-50/80 rounded-3xl border border-slate-100 active:scale-[0.98] transition-all hover:bg-white hover:border-[#8D30F4]/10">
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-500 shadow-sm border border-slate-100 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300">
                             <UserPlus size={24} />
                          </div>
                          <div className="text-left">
                             <span className="text-base font-black text-[#2E0B5E] font-noto block leading-none">Manage Teachers</span>
                             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Portal Access Controls</span>
                          </div>
                        </div>
                        <ChevronRight size={20} className="text-slate-300 group-hover:text-[#8D30F4] transition-all" />
                      </button>

                      <button onClick={() => setView('data-management')} className="group flex items-center justify-between p-6 bg-slate-50/80 rounded-3xl border border-slate-100 active:scale-[0.98] transition-all hover:bg-white hover:border-[#8D30F4]/10">
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-purple-600 shadow-sm border border-slate-100 group-hover:bg-purple-600 group-hover:text-white transition-all duration-300">
                             <Database size={24} />
                          </div>
                          <div className="text-left">
                             <span className="text-base font-black text-[#2E0B5E] font-noto block leading-none">Data Operations</span>
                             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Backup & Excel Sync</span>
                          </div>
                        </div>
                        <ChevronRight size={20} className="text-slate-300 group-hover:text-[#8D30F4] transition-all" />
                      </button>
                    </div>
                  )}
                  <button onClick={() => setIsEditingProfile(true)} className="w-full h-16 bg-[#F2EBFF] text-[#8D30F4] font-black rounded-3xl flex items-center justify-center gap-4 active:scale-[0.98] transition-all border-2 border-[#8D30F4]/10 mb-2 font-noto shadow-sm hover:shadow-md">
                    <Edit3 size={22} /> {t('edit_account_info', lang)}
                  </button>
                </>
              )}

              {/* Language Toggle */}
              <div className="pt-8 border-t border-slate-100 space-y-5">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-3 text-slate-400">
                    <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
                       <Languages size={16} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">{t('language', lang)}</span>
                  </div>
                  <div className="flex p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
                    <button 
                      onClick={() => setLang('bn')} 
                      className={`px-6 py-2 rounded-[1rem] text-[11px] font-black transition-all duration-300 ${lang === 'bn' ? 'bg-white text-[#8D30F4] shadow-[0_5px_15px_-5px_rgba(141,48,244,0.3)]' : 'text-slate-400'}`}
                    >
                      বাংলা
                    </button>
                    <button 
                      onClick={() => setLang('en')} 
                      className={`px-6 py-2 rounded-[1rem] text-[11px] font-black transition-all duration-300 ${lang === 'en' ? 'bg-white text-[#8D30F4] shadow-[0_5px_15px_-5px_rgba(141,48,244,0.3)]' : 'text-slate-400'}`}
                    >
                      ENG
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats - For standard admins only */}
      {!isSuperAdmin && !isEditingProfile && (
        <div className="grid grid-cols-2 gap-4 px-1">
          <div className="bg-white/95 backdrop-blur-3xl p-6 rounded-[2.5rem] border border-white/50 shadow-xl flex flex-col items-center text-center group">
            <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-[1.4rem] flex items-center justify-center mb-4 shadow-inner group-hover:scale-110 transition-transform duration-500">
               <Users size={24} />
            </div>
            <p className="text-3xl font-black text-[#2E0B5E] tracking-tight">{loadingStats ? '...' : stats.students}</p>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">{t('students', lang)}</p>
          </div>
          
          <div className="bg-white/95 backdrop-blur-3xl p-6 rounded-[2.5rem] border border-white/50 shadow-xl flex flex-col items-center text-center group">
            <div className="w-14 h-14 bg-purple-50 text-purple-500 rounded-[1.4rem] flex items-center justify-center mb-4 shadow-inner group-hover:scale-110 transition-transform duration-500">
               <Layers size={24} />
            </div>
            <p className="text-3xl font-black text-[#2E0B5E] tracking-tight">{loadingStats ? '...' : stats.classes}</p>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">{t('classes', lang)}</p>
          </div>

          <div className="bg-white/95 backdrop-blur-3xl p-6 rounded-[2.5rem] border border-white/50 shadow-xl flex flex-col items-center text-center group">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-500 rounded-[1.4rem] flex items-center justify-center mb-4 shadow-inner group-hover:scale-110 transition-transform duration-500">
               <UserPlus size={24} />
            </div>
            <p className="text-3xl font-black text-[#2E0B5E] tracking-tight">{loadingStats ? '...' : stats.teachers}</p>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">{t('teachers', lang)}</p>
          </div>

          <div className="bg-white/95 backdrop-blur-3xl p-6 rounded-[2.5rem] border border-white/50 shadow-xl flex flex-col items-center text-center group">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-[1.4rem] flex items-center justify-center mb-4 shadow-inner group-hover:scale-110 transition-transform duration-500">
               <Zap size={24} />
            </div>
            <p className="text-3xl font-black text-emerald-600 tracking-tight">{loadingStats ? '...' : (madrasah.sms_balance || 0)}</p>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">{lang === 'bn' ? 'ব্যালেন্স' : 'Balance'}</p>
          </div>
        </div>
      )}

      {/* Logout - Always visible at bottom */}
      <div className="px-1 pt-4">
        <button onClick={onLogout} className="w-full py-6 bg-red-500 text-white font-black rounded-[2.8rem] shadow-[0_20px_40px_-10px_rgba(239,68,68,0.4)] active:scale-[0.97] transition-all flex items-center justify-center gap-4 text-lg border-2 border-red-400 font-noto hover:bg-red-600">
          <LogOut size={26} /> {t('logout', lang)}
        </button>
      </div>
    </div>
  );
};

export default Account;
