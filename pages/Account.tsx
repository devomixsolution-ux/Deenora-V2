
import React, { useState, useRef, useEffect } from 'react';
/* Added X to the import list to fix 'Cannot find name X' error on lines 250 and 425 */
import { LogOut, Camera, Loader2, User as UserIcon, ShieldCheck, Database, ChevronRight, Check, MessageSquare, Zap, Globe, Smartphone, Save, Users, Layers, Edit3, UserPlus, Languages, Mail, Key, Settings, Fingerprint, Copy, History, Server, CreditCard, Shield, Sliders, Activity, Bell, RefreshCw, AlertTriangle, GraduationCap, ChevronLeft, ArrowRight, LayoutDashboard, Settings2, X } from 'lucide-react';
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
        <p className="text-sm font-bold opacity-60 font-noto leading-relaxed mb-10">
          আপনার ইমেইল দিয়ে কোনো মাদ্রাসা প্রোফাইল সিস্টেমে রেজিস্টার করা নেই।
        </p>
        <button onClick={onLogout} className="w-full py-5 bg-white text-red-600 font-black rounded-full shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3">
          <LogOut size={22} /> লগ আউট করুন
        </button>
      </div>
    );
  }

  const StatCard = ({ icon: Icon, value, label, color }: { icon: any, value: number | string, label: string, color: string }) => (
    <div className="bg-white/95 rounded-[2.5rem] p-6 border border-white shadow-[0_15px_30px_-5px_rgba(0,0,0,0.05)] relative overflow-hidden group">
      <div className={`absolute -right-4 -top-4 w-16 h-16 rounded-full opacity-5 group-hover:scale-150 transition-transform duration-700 bg-${color}-600`}></div>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-inner border border-${color}-100 bg-${color}-50 text-${color}-600`}>
        <Icon size={24} />
      </div>
      <div className="space-y-1">
        <h4 className="text-2xl font-black text-[#2E0B5E] tracking-tight">
          {loadingStats ? <Loader2 className="animate-spin text-slate-300" size={18} /> : value}
        </h4>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{label}</p>
      </div>
    </div>
  );

  const ActionItem = ({ icon: Icon, title, desc, onClick, color }: { icon: any, title: string, desc: string, onClick: () => void, color: string }) => (
    <button 
      onClick={onClick} 
      className="bg-white/95 p-6 rounded-[2.5rem] border border-white shadow-lg active:scale-[0.97] transition-all hover:shadow-2xl hover:bg-slate-50 text-left flex flex-col gap-4 group"
    >
      <div className={`w-14 h-14 rounded-[1.2rem] flex items-center justify-center shadow-md bg-${color}-600 text-white transition-transform group-hover:rotate-12`}>
        <Icon size={28} />
      </div>
      <div>
        <h5 className="text-[15px] font-black text-[#2E0B5E] font-noto leading-tight">{title}</h5>
        <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{desc}</p>
      </div>
      <div className="mt-auto flex justify-end">
        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-[#8D30F4] group-hover:text-white transition-colors">
          <ArrowRight size={16} />
        </div>
      </div>
    </button>
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-32">
      
      {/* Super Admin Command Center - Sleek Dark Design */}
      {isSuperAdmin && (
        <div className="bg-[#1A0B2E] p-8 rounded-[3.5rem] border border-white/10 shadow-2xl space-y-8 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
              <Shield size={120} className="text-[#A179FF]" />
           </div>
           
           <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-4">
                 <div className="w-14 h-14 bg-[#8D30F4] text-white rounded-[1.5rem] flex items-center justify-center shadow-[0_0_30px_rgba(141,48,244,0.4)]">
                    <LayoutDashboard size={26} />
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-white font-noto tracking-tight">Admin Gateway</h3>
                    <p className="text-[9px] font-black text-[#A179FF] uppercase tracking-[0.2em] mt-1">System Controller</p>
                 </div>
              </div>
              <button 
                onClick={() => setIsEditingGlobal(!isEditingGlobal)} 
                className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${isEditingGlobal ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
              >
                {isEditingGlobal ? <X size={20} /> : <Settings2 size={20} />}
              </button>
           </div>
           
           {isEditingGlobal ? (
              <div className="space-y-5 animate-in slide-in-from-top-4 duration-500 relative z-10">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white/5 p-5 rounded-2xl border border-white/10 focus-within:border-[#8D30F4]/50 transition-all">
                       <label className="text-[9px] font-black text-[#A179FF] uppercase tracking-widest block mb-2">Global API Key</label>
                       <input type="text" className="bg-transparent border-none outline-none font-black text-white text-sm w-full" value={globalSettings.reve_api_key} onChange={(e) => setGlobalSettings({...globalSettings, reve_api_key: e.target.value})} />
                    </div>
                    <div className="bg-white/5 p-5 rounded-2xl border border-white/10 focus-within:border-[#8D30F4]/50 transition-all">
                       <label className="text-[9px] font-black text-[#A179FF] uppercase tracking-widest block mb-2">Global Secret Key</label>
                       <input type="text" className="bg-transparent border-none outline-none font-black text-white text-sm w-full" value={globalSettings.reve_secret_key} onChange={(e) => setGlobalSettings({...globalSettings, reve_secret_key: e.target.value})} />
                    </div>
                 </div>
                 <button onClick={handleSaveGlobalSettings} disabled={saving} className="w-full py-5 bg-[#8D30F4] text-white font-black rounded-3xl text-sm shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3">
                    {saving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> Deploy Global System Update</>}
                 </button>
              </div>
           ) : (
              <div className="flex gap-4 relative z-10">
                 <div className="flex-1 bg-white/5 p-5 rounded-3xl border border-white/10 flex items-center gap-4">
                    <div className="w-10 h-10 bg-green-500/20 text-green-400 rounded-xl flex items-center justify-center">
                       <Activity size={20} />
                    </div>
                    <div>
                       <p className="text-[8px] font-black text-[#A179FF] uppercase tracking-widest">Network</p>
                       <p className="text-sm font-black text-white">Online</p>
                    </div>
                 </div>
                 <div className="flex-1 bg-white/5 p-5 rounded-3xl border border-white/10 flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center">
                       <Server size={20} />
                    </div>
                    <div>
                       <p className="text-[8px] font-black text-[#A179FF] uppercase tracking-widest">Server</p>
                       <p className="text-sm font-black text-white">Active</p>
                    </div>
                 </div>
              </div>
           )}
        </div>
      )}

      {/* Profile & Identity Card */}
      <div className="bg-white/95 rounded-[3.5rem] p-10 shadow-[0_25px_60px_-15px_rgba(46,11,94,0.15)] border border-white space-y-10 relative overflow-hidden group">
        <div className="flex flex-col items-center gap-8 relative z-10">
          <div className="relative">
            <div className="w-36 h-36 bg-white p-1 rounded-[3.5rem] shadow-2xl border-[8px] border-slate-50 flex items-center justify-center overflow-hidden transition-transform duration-500 hover:scale-105">
               {logoUrl ? <img src={logoUrl} className="w-full h-full object-cover rounded-[2.8rem]" alt="Logo" /> : isSuperAdmin ? <ShieldCheck size={60} className="text-indigo-600" /> : <UserIcon size={55} className="text-[#8D30F4]" />}
            </div>
            {!isTeacher && (
              <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-1 right-1 w-12 h-12 bg-[#8D30F4] text-white rounded-2xl flex items-center justify-center shadow-xl border-4 border-white active:scale-90 transition-all">
                <Camera size={22} />
              </button>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
          </div>

          <div className="text-center space-y-3">
             <h2 className="text-3xl font-black text-[#2E0B5E] font-noto tracking-tight leading-tight">{madrasah.name}</h2>
             {isTeacher && <div className="inline-flex px-5 py-1.5 bg-[#8D30F4] rounded-full text-[9px] font-black text-white uppercase tracking-[0.3em] shadow-lg">Authorized Teacher</div>}
             
             <div className="flex justify-center pt-2">
                <div 
                  onClick={() => copyToClipboard(madrasah.id)}
                  className="bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100 flex items-center gap-4 active:scale-95 transition-all cursor-pointer hover:bg-white hover:border-[#8D30F4]/30"
                >
                  <Fingerprint size={18} className="text-[#8D30F4]" />
                  <div className="flex flex-col items-start min-w-0">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Organization UUID</p>
                    <p className="text-[12px] font-black text-[#8D30F4] tracking-tight truncate max-w-[150px]">
                      {madrasah.id}
                    </p>
                  </div>
                  {copiedId ? <Check size={16} className="text-green-500" /> : <Copy size={16} className="text-slate-300" />}
                </div>
             </div>
          </div>
        </div>

        {/* Dynamic Statistics Pulsing Grid */}
        <div className="grid grid-cols-2 gap-4">
           <StatCard icon={Users} value={stats.students} label={t('students', lang)} color="purple" />
           <StatCard icon={Layers} value={stats.classes} label={t('classes', lang)} color="blue" />
           <StatCard icon={GraduationCap} value={stats.teachers} label={t('teachers', lang)} color="emerald" />
           <StatCard icon={Zap} value={madrasah.sms_balance || 0} label="SMS Balance" color="amber" />
        </div>
      </div>

      {/* Quick Action Feature Grid */}
      {!isTeacher && !isSuperAdmin && (
        <div className="space-y-6">
           <div className="px-3 flex items-center justify-between">
              <h4 className="text-[11px] font-black text-white uppercase tracking-[0.3em] opacity-80 drop-shadow-md">Core Management</h4>
              <LayoutDashboard size={14} className="text-white opacity-50" />
           </div>
           <div className="grid grid-cols-2 gap-4 px-1">
              <ActionItem 
                icon={UserPlus} 
                title="Manage Teachers" 
                desc="Access Controls" 
                onClick={() => setView('teachers')} 
                color="indigo" 
              />
              <ActionItem 
                icon={Database} 
                title="Data Operations" 
                desc="Backup & Sync" 
                onClick={() => setView('data-management')} 
                color="purple" 
              />
           </div>
        </div>
      )}

      {/* Account Settings List */}
      <div className="bg-white/95 rounded-[3rem] p-4 shadow-xl border border-white divide-y divide-slate-50">
        {!isTeacher && (
          <button onClick={() => setIsEditingProfile(true)} className="w-full p-6 flex items-center justify-between group active:bg-slate-50 transition-colors first:rounded-t-[2.5rem]">
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 bg-purple-50 text-[#8D30F4] rounded-2xl flex items-center justify-center border border-purple-100 shadow-inner">
                <Edit3 size={22} />
              </div>
              <div className="text-left">
                <h5 className="text-[15px] font-black text-[#2E0B5E] font-noto">{t('edit_account_info', lang)}</h5>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Edit Name & Phone</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-slate-300 group-hover:text-[#8D30F4] transition-colors" />
          </button>
        )}

        <div className="w-full p-6 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center border border-blue-100 shadow-inner">
              <Globe size={22} />
            </div>
            <div className="text-left">
              <h5 className="text-[15px] font-black text-[#2E0B5E] font-noto">{t('language', lang)}</h5>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Select Preference</p>
            </div>
          </div>
          <div className="flex p-1.5 bg-slate-100 rounded-2xl">
            <button onClick={() => setLang('bn')} className={`px-5 py-2 rounded-[1rem] text-[10px] font-black transition-all ${lang === 'bn' ? 'bg-white text-[#8D30F4] shadow-sm' : 'text-slate-400'}`}>বাংলা</button>
            <button onClick={() => setLang('en')} className={`px-5 py-2 rounded-[1rem] text-[10px] font-black transition-all ${lang === 'en' ? 'bg-white text-[#8D30F4] shadow-sm' : 'text-slate-400'}`}>ENG</button>
          </div>
        </div>

        <button onClick={onLogout} className="w-full p-6 flex items-center justify-between group active:bg-red-50 transition-colors last:rounded-b-[2.5rem]">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center border border-red-100 shadow-inner">
              <LogOut size={22} />
            </div>
            <div className="text-left">
              <h5 className="text-[15px] font-black text-red-600 font-noto">{t('logout', lang)}</h5>
              <p className="text-[9px] font-bold text-red-300 uppercase tracking-widest mt-0.5">Exit Session</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-red-200 group-hover:text-red-500 transition-colors" />
        </button>
      </div>

      {/* Edit Profile Modal (Optional/In-place) */}
      {isEditingProfile && (
        <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-2xl z-[600] flex items-center justify-center p-6 animate-in fade-in">
           <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-10 shadow-2xl space-y-8 animate-in zoom-in-95">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-100 text-[#8D30F4] rounded-2xl flex items-center justify-center">
                    <Edit3 size={24} />
                  </div>
                  <h3 className="text-xl font-black text-[#2E0B5E] font-noto">তথ্য সংশোধন</h3>
                </div>
                <button onClick={() => setIsEditingProfile(false)} className="text-slate-300 hover:text-red-500 transition-colors"><X size={24} /></button>
              </div>

              <div className="space-y-5">
                 <div className="space-y-1.5 px-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Organization Name</label>
                    <input type="text" className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 font-black text-[#2E0B5E] outline-none focus:border-[#8D30F4]/30" value={newName} onChange={(e) => setNewName(e.target.value)} />
                 </div>
                 <div className="space-y-1.5 px-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Contact Phone</label>
                    <input type="tel" className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 font-black text-[#2E0B5E] outline-none focus:border-[#8D30F4]/30" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                 </div>
              </div>

              <div className="flex gap-3">
                 <button onClick={() => setIsEditingProfile(false)} className="flex-1 py-5 bg-slate-100 text-slate-500 font-black rounded-3xl text-sm active:scale-95 transition-all">Cancel</button>
                 <button onClick={handleUpdate} disabled={saving} className="flex-[2] py-5 bg-[#8D30F4] text-white font-black rounded-3xl text-sm shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3">
                    {saving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> Save Changes</>}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Account;
