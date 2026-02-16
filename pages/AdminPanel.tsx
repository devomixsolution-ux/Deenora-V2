
import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Search, ChevronRight, User as UserIcon, ShieldCheck, Database, Globe, CheckCircle, XCircle, CreditCard, Save, X, Settings, Smartphone, MessageSquare, Key, Shield, ArrowLeft, Copy, Check, Calendar, Users, Layers, MonitorSmartphone, Server, BarChart3, TrendingUp, RefreshCcw, Clock, Hash, History as HistoryIcon, Zap, Activity, PieChart, Users2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase, smsApi } from '../supabase';
import { Madrasah, Language, Transaction, AdminSMSStock } from '../types';

interface MadrasahWithStats extends Madrasah {
  student_count?: number;
  class_count?: number;
}

interface AdminPanelProps {
  lang: Language;
  currentView?: 'list' | 'dashboard' | 'approvals';
  dataVersion?: number;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ lang, currentView = 'list', dataVersion = 0 }) => {
  const [madrasahs, setMadrasahs] = useState<MadrasahWithStats[]>([]);
  const [pendingTrans, setPendingTrans] = useState<Transaction[]>([]);
  const [transactionHistory, setTransactionHistory] = useState<Transaction[]>([]);
  const [selectedUserHistory, setSelectedUserHistory] = useState<Transaction[]>([]);
  const [adminStock, setAdminStock] = useState<AdminSMSStock | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<'list' | 'approvals' | 'details' | 'dashboard'>(
    currentView === 'approvals' ? 'approvals' : currentView === 'dashboard' ? 'dashboard' : 'list'
  );
  const [smsToCredit, setSmsToCredit] = useState<{ [key: string]: string }>({});

  // Status Modal State
  const [statusModal, setStatusModal] = useState<{show: boolean, type: 'success' | 'error', title: string, message: string}>({
    show: false,
    type: 'success',
    title: '',
    message: ''
  });

  // Global Counts
  const [globalStats, setGlobalStats] = useState({ totalStudents: 0, totalClasses: 0 });

  // Selected User Detail Management
  const [selectedUser, setSelectedUser] = useState<MadrasahWithStats | null>(null);
  const [userStats, setUserStats] = useState({ students: 0, classes: 0 });
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editLoginCode, setEditLoginCode] = useState('');
  const [editActive, setEditActive] = useState(true);
  
  // Madrasah Specific Gateway (Masking)
  const [editReveApiKey, setEditReveApiKey] = useState('');
  const [editReveSecretKey, setEditReveSecretKey] = useState('');
  const [editReveCallerId, setEditReveCallerId] = useState('');

  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const [isRefreshingStats, setIsRefreshingStats] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { initData(); }, [dataVersion]);

  // Update internal view when prop changes (from bottom nav)
  useEffect(() => {
    if (currentView === 'approvals') setView('approvals');
    else if (currentView === 'dashboard') setView('dashboard');
    else if (currentView === 'list') setView('list');
  }, [currentView]);

  const initData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchAllMadrasahs(), 
        fetchPendingTransactions(), 
        fetchTransactionHistory(),
        fetchAdminStock(),
        fetchGlobalCounts()
      ]);
    } catch (err) { 
      console.error("AdminPanel Init Error:", err); 
    } finally { 
      setLoading(false); 
    }
  };

  const showStatus = (type: 'success' | 'error', title: string, message: string) => {
    setStatusModal({ show: true, type, title, message });
    if (type === 'success') {
      setTimeout(() => setStatusModal(prev => ({ ...prev, show: false })), 3000);
    }
  };

  const fetchGlobalCounts = async () => {
    try {
      const [studentsRes, classesRes] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }),
        supabase.from('classes').select('*', { count: 'exact', head: true })
      ]);
      setGlobalStats({
        totalStudents: studentsRes.count || 0,
        totalClasses: classesRes.count || 0
      });
    } catch (e) {
      console.error("Global stats error:", e);
    }
  };

  const fetchAdminStock = async () => {
    const { data } = await supabase.from('admin_sms_stock').select('*').limit(1).maybeSingle();
    if (data) setAdminStock(data);
  };

  const fetchAllMadrasahs = async () => {
    const { data, error } = await supabase.from('madrasahs').select('*').neq('is_super_admin', true).order('created_at', { ascending: false });
    if (error) {
      console.error("Fetch Madrasahs Error:", error);
      return;
    }
    
    if (data) {
      const withStats = await Promise.all(data.map(async (m) => {
        try {
          const [stdCount, clsCount] = await Promise.all([
            supabase.from('students').select('*', { count: 'exact', head: true }).eq('madrasah_id', m.id),
            supabase.from('classes').select('*', { count: 'exact', head: true }).eq('madrasah_id', m.id)
          ]);
          return { ...m, student_count: stdCount.count || 0, class_count: clsCount.count || 0 };
        } catch (e) {
          console.error(`Error fetching stats for madrasah ${m.id}:`, e);
          return { ...m, student_count: 0, class_count: 0 };
        }
      }));
      setMadrasahs(withStats);
    }
  };

  const fetchPendingTransactions = async () => {
    const { data } = await supabase.from('transactions').select('*, madrasahs(*)').eq('status', 'pending').order('created_at', { ascending: false });
    if (data) setPendingTrans(data);
  };

  const fetchTransactionHistory = async () => {
    const { data } = await supabase.from('transactions')
      .select('*, madrasahs(*)')
      .neq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(30);
    if (data) setTransactionHistory(data);
  };

  const fetchSelectedUserHistory = async (madrasahId: string) => {
    const { data } = await supabase.from('transactions')
      .select('*')
      .eq('madrasah_id', madrasahId)
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setSelectedUserHistory(data);
  };

  const totalDistributedSms = useMemo(() => {
    return madrasahs.reduce((acc, curr) => acc + (curr.sms_balance || 0), 0);
  }, [madrasahs]);

  const activeUserCount = useMemo(() => {
    return madrasahs.filter(m => m.is_active !== false).length;
  }, [madrasahs]);

  const fetchDynamicStats = async (madrasahId: string) => {
    setIsRefreshingStats(true);
    try {
      const [studentsRes, classesRes] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('madrasah_id', madrasahId),
        supabase.from('classes').select('*', { count: 'exact', head: true }).eq('madrasah_id', madrasahId),
        fetchSelectedUserHistory(madrasahId)
      ]);
      setUserStats({
        students: studentsRes.count || 0,
        classes: classesRes.count || 0
      });
    } catch (err) {
      console.error("Stats Fetch Error:", err);
    } finally {
      setIsRefreshingStats(false);
    }
  };

  const handleUserClick = async (m: MadrasahWithStats) => {
    setSelectedUser(m);
    setEditName(m.name || '');
    setEditPhone(m.phone || '');
    setEditLoginCode(m.login_code || '');
    setEditActive(m.is_active !== false);
    
    setEditReveApiKey(m.reve_api_key || '');
    setEditReveSecretKey(m.reve_secret_key || '');
    setEditReveCallerId(m.reve_caller_id || '');
    
    setView('details');
    await fetchDynamicStats(m.id);
  };

  const updateUserProfile = async () => {
    if (!selectedUser) return;
    setIsUpdatingUser(true);
    try {
      const { error: updateError } = await supabase.from('madrasahs').update({
        name: editName.trim(),
        phone: editPhone.trim(),
        login_code: editLoginCode.trim(),
        is_active: editActive,
        reve_api_key: editReveApiKey.trim() || null,
        reve_secret_key: editReveSecretKey.trim() || null,
        reve_caller_id: editReveCallerId.trim() || null
      }).eq('id', selectedUser.id);
      
      if (updateError) throw updateError;
      
      showStatus('success', 'সফল হয়েছে!', 'ব্যবহারকারীর তথ্য সফলভাবে আপডেট করা হয়েছে।');
      await initData(); 
      setView('list');
      setSelectedUser(null);
    } catch (err: any) { 
      showStatus('error', 'ব্যর্থ হয়েছে!', err.message);
      console.error(err);
    } finally { 
      setIsUpdatingUser(false); 
    }
  };

  const approveTransaction = async (tr: Transaction) => {
    const sms = Number(smsToCredit[tr.id]);
    if (isNaN(sms) || sms <= 0) return showStatus('error', 'সতর্কতা!', 'অনুগ্রহ করে সঠিক SMS সংখ্যা লিখুন');
    try {
      const { data, error } = await supabase.rpc('approve_payment_with_sms', { t_id: tr.id, m_id: tr.madrasah_id, sms_to_give: sms });
      if (error) throw error;
      
      setPendingTrans(p => p.filter(t => t.id !== tr.id));
      showStatus('success', 'অনুমোদিত!', 'লেনদেনটি সফলভাবে অনুমোদন করা হয়েছে।');
      initData();
    } catch (err: any) { showStatus('error', 'ভুল হয়েছে!', err.message); }
  };

  const filtered = useMemo(() => madrasahs.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase())), [madrasahs, searchQuery]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getSubscriptionDates = (createdAt: string) => {
    const start = new Date(createdAt);
    const end = new Date(createdAt);
    end.setFullYear(start.getFullYear() + 1);
    return {
      start: start.toLocaleDateString('bn-BD'),
      end: end.toLocaleDateString('bn-BD')
    };
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in">
      {view === 'dashboard' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-5">
           <div className="flex items-center justify-between px-2">
              <h1 className="text-xl font-black text-white font-noto drop-shadow-md">সিস্টেম ড্যাশবোর্ড</h1>
           </div>

           {/* Summary Stats Row 1 */}
           <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/95 backdrop-blur-md p-6 rounded-[2.5rem] border border-white shadow-xl flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-3 shadow-inner">
                   <Users2 size={24} />
                </div>
                <h4 className="text-3xl font-black text-[#2E0B5E] leading-none">{loading ? '...' : madrasahs.length}</h4>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Total Madrasahs</p>
              </div>
              
              <div className="bg-white/95 backdrop-blur-md p-6 rounded-[2.5rem] border border-white shadow-xl flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mb-3 shadow-inner">
                   <Activity size={24} />
                </div>
                <h4 className="text-3xl font-black text-[#2E0B5E] leading-none">{loading ? '...' : activeUserCount}</h4>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Active Portals</p>
              </div>
           </div>

           {/* Global SMS Analytics */}
           <div className="bg-white/95 backdrop-blur-xl p-8 rounded-[3rem] border border-white shadow-2xl space-y-8 relative overflow-hidden">
              <div className="flex items-center justify-between px-1">
                 <div>
                   <h3 className="text-lg font-black text-[#2E0B5E] font-noto leading-tight">SMS Analytics</h3>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Global Distribution Overview</p>
                 </div>
                 <div className="w-12 h-12 bg-[#F2EBFF] text-[#8D30F4] rounded-2xl flex items-center justify-center shadow-inner">
                    <Zap size={24} fill="currentColor" />
                 </div>
              </div>

              <div className="space-y-6">
                 <div className="space-y-2">
                    <div className="flex justify-between items-center px-2">
                       <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Distributed to Users</span>
                       <span className="text-sm font-black text-[#8D30F4]">{totalDistributedSms.toLocaleString()}</span>
                    </div>
                    <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden p-1 shadow-inner">
                       <div 
                         className="h-full bg-gradient-to-r from-[#8D30F4] to-[#A179FF] rounded-full transition-all duration-1000"
                         style={{ width: `${Math.min(100, (totalDistributedSms / 10000) * 100)}%` }}
                       />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Stock Remaining</p>
                       <h5 className="text-xl font-black text-[#2E0B5E]">{adminStock?.remaining_sms || 0}</h5>
                    </div>
                    <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Growth Index</p>
                       <h5 className="text-xl font-black text-emerald-500 flex items-center gap-1">
                          <TrendingUp size={16} /> +12%
                       </h5>
                    </div>
                 </div>
              </div>
           </div>

           {/* Entity Counts Grid */}
           <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#F2EBFF]/50 backdrop-blur-md p-6 rounded-[2.5rem] border border-white/50 shadow-lg">
                 <div className="flex items-center gap-3 mb-2">
                    <Users size={16} className="text-[#8D30F4]" />
                    <span className="text-[9px] font-black text-[#8D30F4] uppercase tracking-widest">Total Students</span>
                 </div>
                 <h4 className="text-2xl font-black text-[#2E0B5E] leading-none">{loading ? '...' : globalStats.totalStudents}</h4>
              </div>

              <div className="bg-[#F2EBFF]/50 backdrop-blur-md p-6 rounded-[2.5rem] border border-white/50 shadow-lg">
                 <div className="flex items-center gap-3 mb-2">
                    <Layers size={16} className="text-[#8D30F4]" />
                    <span className="text-[9px] font-black text-[#8D30F4] uppercase tracking-widest">Total Classes</span>
                 </div>
                 <h4 className="text-2xl font-black text-[#2E0B5E] leading-none">{loading ? '...' : globalStats.totalClasses}</h4>
              </div>
           </div>

           {/* Recent Entities / Health */}
           <div className="bg-white/95 p-6 rounded-[2.8rem] border border-white shadow-xl space-y-5">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                 <Activity size={14} className="text-[#8D30F4]" /> Recent Registrations
              </h3>
              <div className="space-y-3">
                 {madrasahs.slice(0, 4).map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-[#8D30F4] shadow-sm border border-slate-100">
                             <Globe size={14} />
                          </div>
                          <span className="text-[13px] font-black text-slate-700 font-noto truncate max-w-[150px]">{m.name}</span>
                       </div>
                       <span className="text-[10px] font-bold text-slate-400">{new Date(m.created_at).toLocaleDateString('bn-BD')}</span>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      {view === 'list' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
              <h1 className="text-xl font-black text-white font-noto drop-shadow-md">মাদরাসা লিস্ট</h1>
          </div>

          {/* Distributed SMS Summary Card */}
          <div className="bg-white/95 backdrop-blur-md p-6 rounded-[2.5rem] border border-white shadow-2xl flex items-center justify-between text-[#2E0B5E] relative overflow-hidden">
             <div className="absolute -right-4 -bottom-4 opacity-5 text-[#8D30F4]">
                <Zap size={120} />
             </div>
             <div className="relative z-10">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1.5">Distributed SMS</p>
                <div className="flex items-baseline gap-2">
                   <h3 className="text-4xl font-black">{loading ? '...' : totalDistributedSms}</h3>
                   <span className="text-[10px] font-black uppercase tracking-widest text-[#8D30F4]/60">Credits</span>
                </div>
             </div>
             <div className="w-14 h-14 bg-[#F2EBFF] text-[#8D30F4] rounded-[1.5rem] flex items-center justify-center shadow-inner shrink-0">
                <Zap size={30} fill="currentColor" />
             </div>
          </div>

          {/* Search Header */}
          <div className="relative group px-1">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#8D30F4] transition-colors" size={18} />
            <input type="text" placeholder="Search Madrasah..." className="w-full h-14 pl-14 pr-14 bg-white border border-[#8D30F4]/5 rounded-[2rem] outline-none text-slate-800 font-bold shadow-xl focus:border-[#8D30F4]/20 transition-all" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            <button onClick={initData} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8D30F4] p-2 hover:bg-slate-50 rounded-xl transition-all">
               <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="space-y-3">
            {loading && madrasahs.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-20 text-white/40">
                  <Loader2 className="animate-spin mb-3" size={32} />
                  <p className="text-[10px] font-black uppercase tracking-widest">Loading Records...</p>
               </div>
            ) : filtered.map(m => (
              <div key={m.id} onClick={() => handleUserClick(m)} className="bg-white/95 backdrop-blur-md p-5 rounded-[2.2rem] border border-white/50 flex flex-col shadow-lg active:scale-[0.98] transition-all cursor-pointer group">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 border border-slate-100 shadow-inner overflow-hidden shrink-0">
                      {m.logo_url ? <img src={m.logo_url} className="w-full h-full object-cover" /> : <UserIcon size={24} />}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-black text-slate-800 truncate font-noto text-lg leading-tight">{m.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <p className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${m.is_active !== false ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                          {m.is_active !== false ? 'Active' : 'Blocked'}
                        </p>
                        <span className="text-[10px] text-slate-300">•</span>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{m.phone || 'No Phone'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 bg-[#F2F5FF] px-4 py-2 rounded-2xl border border-blue-50 shadow-inner flex flex-col items-center justify-center">
                     <p className="text-lg font-black text-[#8D30F4] leading-none">{m.sms_balance || 0}</p>
                     <p className="text-[7px] font-black text-slate-400 uppercase tracking-tighter mt-1">SMS</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-50">
                   <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl">
                      <Users size={12} className="text-slate-400" />
                      <span className="text-[10px] font-black text-slate-600">{m.student_count} Students</span>
                   </div>
                   <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl">
                      <Layers size={12} className="text-slate-400" />
                      <span className="text-[10px] font-black text-slate-600">{m.class_count} Classes</span>
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'details' && selectedUser && (
        <div className="animate-in slide-in-from-right-5 duration-300 space-y-6">
           <div className="flex items-center gap-4 px-2">
              <button onClick={() => setView('list')} className="w-11 h-11 bg-white/20 backdrop-blur-md rounded-[1rem] flex items-center justify-center text-white active:scale-90 transition-all border border-white/20 shadow-xl">
                <ArrowLeft size={22} strokeWidth={3} />
              </button>
              <div className="flex-1">
                <h1 className="text-xl font-black text-white font-noto drop-shadow-md">User Details</h1>
              </div>
              <button onClick={() => fetchDynamicStats(selectedUser.id)} className={`w-11 h-11 bg-white/20 backdrop-blur-md rounded-[1rem] flex items-center justify-center text-white active:scale-90 transition-all border border-white/20 shadow-xl ${isRefreshingStats ? 'animate-spin' : ''}`}>
                 <RefreshCcw size={18} />
              </button>
           </div>

           <div className="bg-white/95 backdrop-blur-xl rounded-[2.8rem] p-8 border border-white shadow-2xl space-y-8 relative overflow-hidden">
              <div className="flex flex-col items-center text-center">
                 <div className="w-24 h-24 bg-slate-50 rounded-[2.2rem] flex items-center justify-center text-slate-300 border-4 border-white shadow-xl overflow-hidden mb-4">
                    {selectedUser.logo_url ? <img src={selectedUser.logo_url} className="w-full h-full object-cover" /> : <UserIcon size={40} />}
                 </div>
                 <h2 className="text-2xl font-black text-slate-800 font-noto tracking-tight">{selectedUser.name}</h2>
                 <div onClick={() => copyToClipboard(selectedUser.id)} className="mt-3 bg-[#F2EBFF] px-4 py-1.5 rounded-xl border border-[#8D30F4]/10 flex items-center gap-2 cursor-pointer active:scale-95 transition-all">
                    <Shield size={12} className="text-[#8D30F4]" />
                    <p className="text-[9px] font-black text-[#8D30F4] uppercase tracking-widest">ID: {selectedUser.id}</p>
                    {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} className="text-[#8D30F4]/40" />}
                 </div>
              </div>

              {/* Stat Grid */}
              <div className="grid grid-cols-3 gap-3">
                 <div className="bg-slate-50 p-4 rounded-3xl text-center border border-slate-100">
                    <Users size={18} className="mx-auto text-[#8D30F4] mb-2" />
                    <p className="text-lg font-black text-slate-800 leading-none">
                      {isRefreshingStats ? '...' : userStats.students}
                    </p>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Students</p>
                 </div>
                 <div className="bg-slate-50 p-4 rounded-3xl text-center border border-slate-100">
                    <Layers size={18} className="mx-auto text-[#8D30F4] mb-2" />
                    <p className="text-lg font-black text-slate-800 leading-none">
                      {isRefreshingStats ? '...' : userStats.classes}
                    </p>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Classes</p>
                 </div>
                 <div className="bg-slate-50 p-4 rounded-3xl text-center border border-slate-100">
                    <MonitorSmartphone size={18} className="mx-auto text-[#8D30F4] mb-2" />
                    <p className="text-lg font-black text-slate-800 leading-none">1</p>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Devices</p>
                 </div>
              </div>

              <div className="bg-gradient-to-br from-[#8D30F4] to-[#A179FF] p-6 rounded-[2.2rem] text-white shadow-xl relative overflow-hidden">
                 <Calendar className="absolute -right-4 -bottom-4 opacity-10" size={100} />
                 <div className="relative z-10 flex items-center justify-between">
                    <div>
                       <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Subscription Status</p>
                       <h4 className="text-xl font-black mt-1">1 Year Premium</h4>
                    </div>
                    <div className="bg-white/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">Active</div>
                 </div>
                 <div className="mt-5 pt-5 border-t border-white/20 flex justify-between">
                    <div>
                       <p className="text-[8px] font-black uppercase opacity-60">Start Date</p>
                       <p className="text-xs font-black">{getSubscriptionDates(selectedUser.created_at).start}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[8px] font-black uppercase opacity-60">End Date</p>
                       <p className="text-xs font-black">{getSubscriptionDates(selectedUser.created_at).end}</p>
                    </div>
                 </div>
              </div>

              <div className="space-y-4">
                 <h4 className="text-[11px] font-black text-[#8D30F4] uppercase tracking-[0.2em] px-1 flex items-center gap-2"><UserIcon size={14}/> Basic Information</h4>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Madrasah Name</label>
                    <input type="text" className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 font-black text-slate-800 font-noto" value={editName} onChange={(e) => setEditName(e.target.value)} />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Mobile Number</label>
                    <input type="tel" className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 font-black text-slate-800" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Madrasah Login Code</label>
                    <div className="relative">
                       <input type="text" className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 font-black text-[#8D30F4]" value={editLoginCode} onChange={(e) => setEditLoginCode(e.target.value)} />
                       <Key size={16} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" />
                    </div>
                 </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                 <h4 className="text-[11px] font-black text-[#8D30F4] uppercase tracking-[0.2em] px-1 flex items-center gap-2"><Server size={14}/> SMS Gateway (Masking)</h4>
                 <p className="text-[9px] text-slate-400 font-bold px-1 -mt-2 italic">খালি রাখলে গ্লোবাল গেটওয়ে (Non-Masking) ব্যবহৃত হবে।</p>
                 
                 <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">API Key</label>
                       <input type="text" className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 font-black text-slate-700 text-xs" value={editReveApiKey} onChange={(e) => setEditReveApiKey(e.target.value)} placeholder="Reve API Key" />
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Secret Key</label>
                       <input type="text" className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 font-black text-slate-700 text-xs" value={editReveSecretKey} onChange={(e) => setEditReveSecretKey(e.target.value)} placeholder="Secret Key" />
                    </div>
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Sender ID</label>
                    <input type="text" className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 font-black text-slate-700 text-xs" value={editReveCallerId} onChange={(e) => setEditReveCallerId(e.target.value)} placeholder="Masking Name" />
                 </div>
              </div>
                 
              <div className="flex items-center justify-between bg-slate-50 p-5 rounded-[1.8rem] border border-slate-100">
                 <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${editActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                    <span className="text-sm font-black text-slate-700">Account Access</span>
                 </div>
                 <button onClick={() => setEditActive(!editActive)} className={`w-14 h-8 rounded-full transition-all relative ${editActive ? 'bg-green-500' : 'bg-slate-300'}`}>
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all ${editActive ? 'right-1' : 'left-1'}`} />
                 </button>
              </div>

              <button onClick={updateUserProfile} disabled={isUpdatingUser} className="w-full h-16 premium-btn text-white font-black rounded-[2rem] flex items-center justify-center gap-3 shadow-xl active:scale-[0.98] transition-all">
                 {isUpdatingUser ? <Loader2 className="animate-spin" size={24} /> : <><Save size={24} /> Save User Settings</>}
              </button>
           </div>
        </div>
      )}

      {view === 'approvals' && (
        <div className="space-y-8 px-1">
          <div className="flex items-center justify-between px-2">
              <h1 className="text-xl font-black text-white font-noto drop-shadow-md">পেমেন্ট ও রিচার্জ রিকোয়েস্ট</h1>
          </div>
          
          {/* Pending Section */}
          <div className="space-y-4">
            <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em] px-2 opacity-80 flex items-center gap-2">
              <Clock size={12} /> Pending Requests
            </h2>
            {pendingTrans.length > 0 ? pendingTrans.map(tr => (
              <div key={tr.id} className="bg-white p-5 rounded-[2rem] border border-white shadow-xl space-y-4 animate-in slide-in-from-bottom-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="bg-green-50 text-green-600 px-3 py-1 rounded-full text-[14px] font-black border border-green-100 flex items-center gap-1.5 shadow-sm">
                      <TrendingUp size={14} /> {tr.amount} ৳
                    </div>
                    <div className="bg-slate-50 text-slate-400 px-3 py-1 rounded-full text-[9px] font-black border border-slate-100 flex items-center gap-1">
                      <Clock size={12} /> {new Date(tr.created_at).toLocaleDateString('bn-BD')}
                    </div>
                  </div>
                  <div className="w-9 h-9 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center border border-blue-100 shadow-inner">
                    <CreditCard size={18} />
                  </div>
                </div>

                <div className="px-1">
                  <p className="text-[14px] font-black text-slate-800 font-noto leading-tight">{tr.madrasahs?.name}</p>
                  <div className="flex items-center gap-2 mt-1 opacity-60">
                    <Smartphone size={10} className="text-[#8D30F4]" />
                    <span className="text-[10px] font-black text-[#8D30F4] uppercase tracking-widest">{tr.madrasahs?.phone || 'No Phone'}</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 grid grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Sender</p>
                    <p className="text-[11px] font-black text-slate-700 truncate">{tr.sender_phone}</p>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">TrxID</p>
                    <p className="text-[11px] font-black text-[#8D30F4] uppercase truncate">{tr.transaction_id}</p>
                  </div>
                </div>

                <div className="relative group">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#8D30F4]" size={14} />
                  <input 
                    type="number" 
                    className="w-full h-12 pl-10 pr-5 bg-slate-50 border border-slate-100 rounded-xl font-black text-sm outline-none focus:border-[#8D30F4]/30 transition-all text-center" 
                    value={smsToCredit[tr.id] || ''} 
                    onChange={(e) => setSmsToCredit({...smsToCredit, [tr.id]: e.target.value})} 
                    placeholder="Give SMS Credits (e.g. 500)" 
                  />
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => approveTransaction(tr)} 
                    className="flex-[2] h-12 bg-green-500 text-white font-black rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-100 active:scale-95 transition-all text-xs"
                  >
                    <CheckCircle size={16} /> Approve
                  </button>
                  <button 
                    onClick={async () => { if(confirm('Reject?')) { await supabase.from('transactions').update({ status: 'rejected' }).eq('id', tr.id); initData(); } }} 
                    className="flex-1 h-12 bg-red-50 text-red-500 font-black rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all text-xs border border-red-100"
                  >
                    <XCircle size={16} /> Reject
                  </button>
                </div>
              </div>
            )) : (
              <div className="text-center py-10 bg-white/10 rounded-[2.5rem] border-2 border-dashed border-white/30 backdrop-blur-sm">
                <p className="text-white font-black uppercase text-[10px] tracking-[0.2em] drop-shadow-sm">No pending requests</p>
              </div>
            )}
          </div>

          {/* History Section */}
          <div className="space-y-4">
            <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em] px-2 opacity-80 flex items-center gap-2">
              <HistoryIcon size={12} /> Transaction History
            </h2>
            <div className="space-y-2">
              {transactionHistory.length > 0 ? transactionHistory.map(tr => (
                <div key={tr.id} className="bg-white/95 backdrop-blur-md p-4 rounded-[1.8rem] border border-white/40 flex items-center justify-between shadow-lg">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-slate-800 text-sm truncate font-noto">{tr.madrasahs?.name}</h4>
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${tr.status === 'approved' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                        {tr.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr.amount} ৳</p>
                      <span className="text-slate-200 text-xs">•</span>
                      <p className="text-[9px] font-bold text-slate-400 truncate">{new Date(tr.created_at).toLocaleDateString('bn-BD')}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[8px] font-black text-[#8D30F4] uppercase tracking-tighter truncate max-w-[80px]">{tr.transaction_id}</p>
                  </div>
                </div>
              )) : (
                <p className="text-center text-white/40 text-[9px] font-black uppercase tracking-widest py-4">No history records yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM STATUS MODAL */}
      {statusModal.show && (
        <div className="fixed inset-0 bg-[#080A12]/40 backdrop-blur-2xl z-[1000] flex items-center justify-center p-8 animate-in fade-in duration-300">
          <div className={`bg-white w-full max-w-sm rounded-[3.5rem] p-12 text-center shadow-2xl border ${statusModal.type === 'success' ? 'border-green-100 shadow-green-200/20' : 'border-red-100 shadow-red-200/20'} animate-in zoom-in-95 duration-300`}>
             <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner border ${statusModal.type === 'success' ? 'bg-green-50 text-green-500 border-green-100' : 'bg-red-50 text-red-500 border-red-100'}`}>
                {statusModal.type === 'success' ? <CheckCircle2 size={56} strokeWidth={2.5} /> : <AlertCircle size={56} strokeWidth={2.5} />}
             </div>
             <h3 className="text-2xl font-black text-slate-800 font-noto tracking-tight">{statusModal.title}</h3>
             <p className="text-[13px] font-bold text-slate-400 mt-4 leading-relaxed font-noto">{statusModal.message}</p>
             <button 
                onClick={() => setStatusModal(prev => ({ ...prev, show: false }))} 
                className={`w-full mt-10 py-5 font-black rounded-full shadow-xl active:scale-95 transition-all text-sm uppercase tracking-widest ${statusModal.type === 'success' ? 'bg-green-500 text-white shadow-green-200' : 'bg-red-500 text-white shadow-red-200'}`}
              >
                ঠিক আছে
              </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
