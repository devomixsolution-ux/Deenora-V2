
import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Search, ChevronRight, User as UserIcon, ShieldCheck, Database, Globe, CheckCircle, XCircle, CreditCard, Save, X, Settings, Smartphone, MessageSquare, Key, Shield, ArrowLeft, Copy, Check, Calendar, Users, Layers, MonitorSmartphone, Server, BarChart3, TrendingUp, RefreshCcw, Clock, Hash, History as HistoryIcon, Zap, Activity, PieChart, Users2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
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

  const [statusModal, setStatusModal] = useState<{show: boolean, type: 'success' | 'error', title: string, message: string}>({
    show: false,
    type: 'success',
    title: '',
    message: ''
  });

  const [globalStats, setGlobalStats] = useState({ totalStudents: 0, totalClasses: 0 });
  const [selectedUser, setSelectedUser] = useState<MadrasahWithStats | null>(null);
  const [userStats, setUserStats] = useState({ students: 0, classes: 0 });
  
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editLoginCode, setEditLoginCode] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editReveApiKey, setEditReveApiKey] = useState('');
  const [editReveSecretKey, setEditReveSecretKey] = useState('');
  const [editReveCallerId, setEditReveCallerId] = useState('');

  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const [isRefreshingStats, setIsRefreshingStats] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { 
    initData(); 
  }, [dataVersion, view]);

  useEffect(() => {
    if (currentView === 'approvals') setView('approvals');
    else if (currentView === 'dashboard') setView('dashboard');
    else if (currentView === 'list') setView('list');
  }, [currentView]);

  const initData = async () => {
    setLoading(true);
    try {
      if (view === 'list' || view === 'dashboard') {
        await fetchAllMadrasahs();
        await fetchGlobalCounts();
        await fetchAdminStock();
      }
      if (view === 'approvals') {
        await fetchPendingTransactions();
        await fetchTransactionHistory();
      }
    } catch (err) { 
      console.error("AdminPanel Init Error:", err); 
    } finally { 
      setLoading(false); 
    }
  };

  const fetchGlobalCounts = async () => {
    const [studentsRes, classesRes] = await Promise.all([
      supabase.from('students').select('*', { count: 'exact', head: true }),
      supabase.from('classes').select('*', { count: 'exact', head: true })
    ]);
    setGlobalStats({
      totalStudents: studentsRes.count || 0,
      totalClasses: classesRes.count || 0
    });
  };

  const fetchAdminStock = async () => {
    const { data } = await supabase.from('admin_sms_stock').select('*').limit(1).maybeSingle();
    if (data) setAdminStock(data);
  };

  const fetchAllMadrasahs = async () => {
    const { data, error } = await supabase.from('madrasahs')
      .select('*')
      .eq('is_super_admin', false)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    if (data) {
      const withStats = await Promise.all(data.map(async (m) => {
        const [stdCount, clsCount] = await Promise.all([
          supabase.from('students').select('*', { count: 'exact', head: true }).eq('madrasah_id', m.id),
          supabase.from('classes').select('*', { count: 'exact', head: true }).eq('madrasah_id', m.id)
        ]);
        return { ...m, student_count: stdCount.count || 0, class_count: clsCount.count || 0 };
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

  const fetchDynamicStats = async (madrasahId: string) => {
    setIsRefreshingStats(true);
    try {
      const [studentsRes, classesRes] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('madrasah_id', madrasahId),
        supabase.from('classes').select('*', { count: 'exact', head: true }).eq('madrasah_id', madrasahId),
        supabase.from('transactions').select('*').eq('madrasah_id', madrasahId).order('created_at', { ascending: false }).limit(5)
      ]);
      setUserStats({
        students: studentsRes.count || 0,
        classes: classesRes.count || 0
      });
      if (studentsRes.data) setSelectedUserHistory(studentsRes.data as any);
    } catch (err) {
      console.error(err);
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
    fetchDynamicStats(m.id);
  };

  const approveTransaction = async (tr: Transaction) => {
    const sms = Number(smsToCredit[tr.id]);
    if (!sms || sms <= 0) {
      setStatusModal({ show: true, type: 'error', title: 'ত্রুটি', message: 'সঠিক SMS সংখ্যা লিখুন' });
      return;
    }
    try {
      const { error } = await supabase.rpc('approve_payment_with_sms', { 
        t_id: tr.id, 
        m_id: tr.madrasah_id, 
        sms_to_give: sms 
      });
      if (error) throw error;
      setStatusModal({ show: true, type: 'success', title: 'সফল', message: 'রিচার্জ সফল হয়েছে' });
      initData();
    } catch (err: any) {
      setStatusModal({ show: true, type: 'error', title: 'ব্যর্থ', message: err.message });
    }
  };

  const filtered = useMemo(() => madrasahs.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase())), [madrasahs, searchQuery]);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-white">
          <Loader2 className="animate-spin mb-4" size={40} />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Loading System Data...</p>
        </div>
      ) : (
        <>
          {view === 'dashboard' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-5">
              <div className="flex items-center justify-between px-2">
                <h1 className="text-xl font-black text-white font-noto drop-shadow-md">সিস্টেম ড্যাশবোর্ড</h1>
                <button onClick={initData} className="p-2 bg-white/20 rounded-xl text-white backdrop-blur-md active:scale-95 transition-all">
                   <RefreshCw size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/95 p-6 rounded-[2.5rem] border border-white shadow-xl flex flex-col items-center text-center">
                  <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-3 shadow-inner">
                    <Users2 size={24} />
                  </div>
                  <h4 className="text-3xl font-black text-[#2E0B5E]">{madrasahs.length}</h4>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">Madrasahs</p>
                </div>
                <div className="bg-white/95 p-6 rounded-[2.5rem] border border-white shadow-xl flex flex-col items-center text-center">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mb-3 shadow-inner">
                    <Activity size={24} />
                  </div>
                  <h4 className="text-3xl font-black text-[#2E0B5E]">{madrasahs.filter(m => m.is_active).length}</h4>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">Active Portals</p>
                </div>
              </div>

              <div className="bg-white/95 p-8 rounded-[3rem] border border-white shadow-2xl space-y-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-[#2E0B5E] font-noto">SMS Analytics</h3>
                  <Zap size={24} className="text-[#8D30F4]" fill="currentColor" />
                </div>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Global Stock</p>
                      <h5 className="text-xl font-black text-[#2E0B5E]">{adminStock?.remaining_sms || 0}</h5>
                    </div>
                    <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Distributed</p>
                      <h5 className="text-xl font-black text-[#8D30F4]">{madrasahs.reduce((a, c) => a + (c.sms_balance || 0), 0)}</h5>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#F2EBFF]/50 p-6 rounded-[2.5rem] border border-white/50 shadow-lg">
                  <span className="text-[9px] font-black text-[#8D30F4] uppercase tracking-widest">Students</span>
                  <h4 className="text-2xl font-black text-[#2E0B5E]">{globalStats.totalStudents}</h4>
                </div>
                <div className="bg-[#F2EBFF]/50 p-6 rounded-[2.5rem] border border-white/50 shadow-lg">
                  <span className="text-[9px] font-black text-[#8D30F4] uppercase tracking-widest">Classes</span>
                  <h4 className="text-2xl font-black text-[#2E0B5E]">{globalStats.totalClasses}</h4>
                </div>
              </div>
            </div>
          )}

          {view === 'list' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <h1 className="text-xl font-black text-white font-noto drop-shadow-md">মাদরাসা লিস্ট</h1>
              </div>

              <div className="relative group px-1">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input type="text" placeholder="Search Madrasah..." className="w-full h-14 pl-14 pr-14 bg-white border border-[#8D30F4]/5 rounded-[2rem] outline-none text-slate-800 font-bold shadow-xl" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>

              <div className="space-y-3">
                {filtered.length > 0 ? filtered.map(m => (
                  <div key={m.id} onClick={() => handleUserClick(m)} className="bg-white/95 p-5 rounded-[2.2rem] border border-white/50 flex flex-col shadow-lg active:scale-[0.98] transition-all cursor-pointer">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 border border-slate-100 shadow-inner shrink-0 overflow-hidden">
                          {m.logo_url ? <img src={m.logo_url} className="w-full h-full object-cover" /> : <UserIcon size={24} />}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-black text-slate-800 truncate font-noto text-lg">{m.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <p className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${m.is_active ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                              {m.is_active ? 'Active' : 'Blocked'}
                            </p>
                            <span className="text-[10px] text-slate-300">•</span>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{m.phone || 'No Phone'}</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right bg-[#F2F5FF] px-4 py-2 rounded-2xl border border-blue-50 flex flex-col items-center">
                        <p className="text-lg font-black text-[#8D30F4]">{m.sms_balance || 0}</p>
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">SMS</p>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-20 bg-white/10 rounded-[2.5rem] border-2 border-dashed border-white/30">
                    <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">No Madrasahs Found</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {view === 'approvals' && (
            <div className="space-y-8 px-1">
              <div className="flex items-center justify-between px-2">
                <h1 className="text-xl font-black text-white font-noto drop-shadow-md">পেমেন্ট রিকোয়েস্ট</h1>
              </div>
              
              <div className="space-y-4">
                {pendingTrans.length > 0 ? pendingTrans.map(tr => (
                  <div key={tr.id} className="bg-white p-5 rounded-[2rem] border border-white shadow-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="bg-green-50 text-green-600 px-3 py-1 rounded-full text-[14px] font-black">{tr.amount} ৳</div>
                      <div className="text-[9px] font-black text-slate-400 uppercase">{new Date(tr.created_at).toLocaleDateString('bn-BD')}</div>
                    </div>
                    <div className="px-1">
                      <p className="text-[14px] font-black text-slate-800 font-noto">{tr.madrasahs?.name}</p>
                      <p className="text-[10px] font-bold text-slate-400">ID: {tr.transaction_id}</p>
                    </div>
                    <div className="flex gap-2 items-center">
                      <input 
                        type="number" 
                        className="flex-1 h-12 px-4 bg-slate-50 border border-slate-100 rounded-xl font-black text-sm text-center" 
                        value={smsToCredit[tr.id] || ''} 
                        onChange={(e) => setSmsToCredit({...smsToCredit, [tr.id]: e.target.value})} 
                        placeholder="Give SMS" 
                      />
                      <button onClick={() => approveTransaction(tr)} className="px-6 h-12 bg-green-500 text-white font-black rounded-xl text-xs active:scale-95 transition-all">অনুমোদন</button>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-20 bg-white/10 rounded-[2.5rem] border-2 border-dashed border-white/30">
                    <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">No Pending Requests</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Status Modal */}
      {statusModal.show && (
        <div className="fixed inset-0 bg-[#080A12]/40 backdrop-blur-2xl z-[1000] flex items-center justify-center p-8 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-12 text-center shadow-2xl">
             <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 ${statusModal.type === 'success' ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'}`}>
                {statusModal.type === 'success' ? <CheckCircle2 size={56} /> : <AlertCircle size={56} />}
             </div>
             <h3 className="text-2xl font-black text-slate-800 font-noto">{statusModal.title}</h3>
             <p className="text-[13px] font-bold text-slate-400 mt-4 font-noto">{statusModal.message}</p>
             <button onClick={() => setStatusModal({ ...statusModal, show: false })} className="w-full mt-10 py-5 bg-slate-800 text-white font-black rounded-full text-sm">ঠিক আছে</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
