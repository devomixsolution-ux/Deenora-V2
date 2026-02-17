
import React, { useState, useEffect } from 'react';
import { Home, User, BookOpen, Wallet, ShieldCheck, BarChart3, CreditCard, RefreshCw, Smartphone, Bell, X, Info, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { View, Language, Madrasah, Teacher, Transaction } from '../types';
import { t } from '../translations';
import { supabase } from '../supabase';

interface LayoutProps {
  children: React.ReactNode;
  currentView: View;
  setView: (view: View) => void;
  lang: Language;
  madrasah: Madrasah | null;
  onUpdateClick?: () => void;
  teacher?: Teacher | null;
}

interface AppNotification {
  id: string;
  title: string;
  desc: string;
  type: 'info' | 'success' | 'error' | 'warning';
  time: string;
}

const Layout: React.FC<LayoutProps> = ({ children, currentView, setView, lang, madrasah, onUpdateClick, teacher }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const isSuperAdmin = madrasah?.is_super_admin === true;

  const fetchDynamicNotifications = async () => {
    if (!madrasah?.id) return;
    
    const newNotifications: AppNotification[] = [];

    // 1. Check for System Update
    newNotifications.push({
      id: 'sys-upd',
      title: t('system_update', lang),
      desc: lang === 'bn' ? 'সিস্টেম ভার্সন ২.৫.১ লাইভ করা হয়েছে।' : 'System version 2.5.1 is now live.',
      type: 'info',
      time: 'Just now'
    });

    // 2. Check for Low Balance
    if (madrasah.sms_balance < 50) {
      newNotifications.push({
        id: 'low-bal',
        title: t('low_balance_title', lang),
        desc: t('low_balance_msg', lang),
        type: 'error',
        time: 'Active'
      });
    }

    // 3. Check for Payment Status (Last 3 transactions)
    try {
      const { data: txs } = await supabase
        .from('transactions')
        .select('*')
        .eq('madrasah_id', madrasah.id)
        .order('created_at', { ascending: false })
        .limit(3);

      if (txs) {
        txs.forEach((tx: Transaction) => {
          let statusMsg = '';
          let type: 'success' | 'error' | 'warning' = 'warning';
          
          if (tx.status === 'approved') {
            statusMsg = t('payment_approved_msg', lang);
            type = 'success';
          } else if (tx.status === 'rejected') {
            statusMsg = t('payment_rejected_msg', lang);
            type = 'error';
          } else {
            statusMsg = t('payment_pending_msg', lang);
            type = 'warning';
          }

          newNotifications.push({
            id: tx.id,
            title: lang === 'bn' ? `পেমেন্ট: ${tx.amount} ৳` : `Payment: ${tx.amount} TK`,
            desc: statusMsg,
            type: type,
            time: new Date(tx.created_at).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { day: 'numeric', month: 'short' })
          });
        });
      }
    } catch (e) {
      console.error("Notify fetch error:", e);
    }

    setNotifications(newNotifications);
  };

  useEffect(() => {
    if (showNotifications) {
      fetchDynamicNotifications();
    }
  }, [showNotifications, madrasah?.id, madrasah?.sms_balance]);

  const isTabActive = (tab: string) => {
    if (tab === 'home' && currentView === 'home') return true;
    if (tab === 'account' && currentView === 'account') return true;
    if (tab === 'dashboard' && currentView === 'admin-dashboard') return true;
    if (tab === 'approvals' && currentView === 'admin-approvals') return true;
    if (!isSuperAdmin) {
        if (tab === 'classes' && (currentView === 'classes' || currentView === 'students' || currentView === 'student-details' || currentView === 'student-form')) return true;
        if (tab === 'wallet' && currentView === 'wallet-sms') return true;
    }
    return false;
  };

  const canSeeClasses = !teacher || (teacher.permissions?.can_manage_students || teacher.permissions?.can_manage_classes);
  const canSeeWallet = !teacher || teacher.permissions?.can_send_sms;

  return (
    <div className="flex flex-col w-full h-full relative bg-transparent overflow-hidden">
      {/* Header */}
      <header className="flex-none px-6 pt-[calc(env(safe-area-inset-top)+8px)] pb-3 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="w-11 h-11 rounded-full flex items-center justify-center bg-white shadow-sm border border-white/20 shrink-0 overflow-hidden">
            {isSuperAdmin ? (
               <ShieldCheck size={24} className="text-[#8D30F4]" />
            ) : madrasah?.logo_url ? (
              <img src={madrasah.logo_url} className="w-full h-full object-cover" alt="Logo" />
            ) : (
              <BookOpen size={22} className="text-[#8D30F4]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-[16px] font-black text-white leading-[1.2] tracking-tight font-noto drop-shadow-md line-clamp-2">
              {isSuperAdmin ? (lang === 'bn' ? 'সুপার অ্যাডমিন' : 'Super Admin') : (madrasah?.name || (lang === 'bn' ? 'মাদরাসা কন্টাক্ট' : 'Madrasah Contact'))}
            </h1>
            <p className="text-[9px] font-black text-white/60 uppercase tracking-[0.2em] mt-1 drop-shadow-sm font-noto">
              {teacher ? t('teacher_portal', lang) : t('admin_portal', lang)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Notification Bell */}
          <button 
            onClick={() => setShowNotifications(true)}
            className="relative p-2.5 bg-white/20 backdrop-blur-md rounded-[1rem] text-white active:scale-95 transition-all border border-white/20 shadow-xl"
          >
            <Bell size={18} />
            {(madrasah?.sms_balance < 50 || notifications.length > 0) && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#9D50FF] animate-pulse"></span>
            )}
          </button>

          <button onClick={() => window.location.reload()} className="p-2.5 bg-white/20 backdrop-blur-md rounded-[1rem] text-white active:scale-95 transition-all border border-white/20 shadow-xl">
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      {/* Main Scrollable Content */}
      <main className="flex-1 overflow-y-auto px-5 pt-2 pb-44 w-full max-w-md mx-auto scroll-smooth custom-scrollbar">
        {children}
      </main>

      {/* Navigation */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[92%] max-w-md z-[200]">
        <nav className="bg-white/95 backdrop-blur-[25px] border border-white/50 flex justify-around items-center py-4 px-2 rounded-[3rem] shadow-[0_25px_60px_-15px_rgba(46,11,94,0.4)]">
          <button onClick={() => setView('home')} className={`relative flex flex-col items-center gap-1 transition-all flex-1 ${isTabActive('home') ? 'text-[#8D30F4]' : 'text-[#A179FF]'}`}>
            <Home size={26} strokeWidth={isTabActive('home') ? 3 : 2} />
            <span className={`text-[12px] font-black font-noto ${isTabActive('home') ? 'opacity-100' : 'opacity-60'}`}>{t('home', lang)}</span>
            {isTabActive('home') && <div className="absolute -top-2 w-1.5 h-1.5 rounded-full bg-[#8D30F4]"></div>}
          </button>
          
          {isSuperAdmin ? (
            <>
              <button onClick={() => setView('admin-approvals')} className={`relative flex flex-col items-center gap-1 transition-all flex-1 ${isTabActive('approvals') ? 'text-[#8D30F4]' : 'text-[#A179FF]'}`}>
                <CreditCard size={26} strokeWidth={isTabActive('approvals') ? 3 : 2} />
                <span className={`text-[12px] font-black font-noto ${isTabActive('approvals') ? 'opacity-100' : 'opacity-60'}`}>{t('approvals', lang)}</span>
                {isTabActive('approvals') && <div className="absolute -top-2 w-1.5 h-1.5 rounded-full bg-[#8D30F4]"></div>}
              </button>
              <button onClick={() => setView('admin-dashboard')} className={`relative flex flex-col items-center gap-1 transition-all flex-1 ${isTabActive('dashboard') ? 'text-[#8D30F4]' : 'text-[#A179FF]'}`}>
                <BarChart3 size={26} strokeWidth={isTabActive('dashboard') ? 3 : 2} />
                <span className={`text-[12px] font-black font-noto ${isTabActive('dashboard') ? 'opacity-100' : 'opacity-60'}`}>{t('dashboard', lang)}</span>
                {isTabActive('dashboard') && <div className="absolute -top-2 w-1.5 h-1.5 rounded-full bg-[#8D30F4]"></div>}
              </button>
            </>
          ) : (
            <>
              {canSeeClasses && (
                <button onClick={() => setView('classes')} className={`relative flex flex-col items-center gap-1 transition-all flex-1 ${isTabActive('classes') ? 'text-[#8D30F4]' : 'text-[#A179FF]'}`}>
                  <Smartphone size={26} strokeWidth={isTabActive('classes') ? 3 : 2} />
                  <span className={`text-[12px] font-black font-noto ${isTabActive('classes') ? 'opacity-100' : 'opacity-60'}`}>ক্লাস</span>
                  {isTabActive('classes') && <div className="absolute -top-2 w-1.5 h-1.5 rounded-full bg-[#8D30F4]"></div>}
                </button>
              )}
              {canSeeWallet && (
                <button onClick={() => setView('wallet-sms')} className={`relative flex flex-col items-center gap-1 transition-all flex-1 ${isTabActive('wallet') ? 'text-[#8D30F4]' : 'text-[#A179FF]'}`}>
                  <Wallet size={26} strokeWidth={isTabActive('wallet') ? 3 : 2} />
                  <span className={`text-[12px] font-black font-noto ${isTabActive('wallet') ? 'opacity-100' : 'opacity-60'}`}>এসএমএস</span>
                  {isTabActive('wallet') && <div className="absolute -top-2 w-1.5 h-1.5 rounded-full bg-[#8D30F4]"></div>}
                </button>
              )}
            </>
          )}
          
          <button onClick={() => setView('account')} className={`relative flex flex-col items-center gap-1 transition-all flex-1 ${isTabActive('account') ? 'text-[#8D30F4]' : 'text-[#A179FF]'}`}>
            <User size={26} strokeWidth={isTabActive('account') ? 3 : 2} />
            <span className={`text-[12px] font-black font-noto ${isTabActive('account') ? 'opacity-100' : 'opacity-60'}`}>{t('account', lang)}</span>
            {isTabActive('account') && <div className="absolute -top-2 w-1.5 h-1.5 rounded-full bg-[#8D30F4]"></div>}
          </button>
        </nav>
      </div>

      {/* Notifications Modal */}
      {showNotifications && (
        <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[9999] flex items-start justify-center p-4 pt-12 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-sm rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-500 border border-slate-100 overflow-hidden flex flex-col max-h-[80vh]">
              <div className="p-6 border-b border-slate-50 flex items-center justify-between shrink-0">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#F2EBFF] text-[#8D30F4] rounded-xl flex items-center justify-center">
                       <Bell size={20} strokeWidth={2.5} />
                    </div>
                    <h3 className="text-xl font-black text-[#2E0B5E] font-noto tracking-tight">{t('notifications', lang)}</h3>
                 </div>
                 <button onClick={() => setShowNotifications(false)} className="w-9 h-9 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center active:scale-90 transition-all">
                    <X size={18} strokeWidth={3} />
                 </button>
              </div>
              
              <div className="p-4 space-y-3 overflow-y-auto custom-scrollbar flex-1">
                 {notifications.length > 0 ? notifications.map(n => (
                    <div key={n.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 relative group active:scale-[0.98] transition-all">
                       <div className="flex gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            n.type === 'success' ? 'bg-green-50 text-green-500' : 
                            n.type === 'error' ? 'bg-red-50 text-red-500' : 
                            n.type === 'warning' ? 'bg-orange-50 text-orange-500' :
                            'bg-blue-50 text-blue-500'
                          }`}>
                             {n.type === 'success' ? <CheckCircle2 size={18} /> : 
                              n.type === 'error' ? <AlertTriangle size={18} /> : 
                              n.type === 'warning' ? <Clock size={18} /> : 
                              <Info size={18} />}
                          </div>
                          <div className="min-w-0 flex-1">
                             <div className="flex items-center justify-between gap-2 mb-1">
                                <h4 className="text-[13px] font-black text-[#2E0B5E] font-noto truncate">{n.title}</h4>
                                <span className="text-[8px] font-black text-slate-400 uppercase shrink-0">{n.time}</span>
                             </div>
                             <p className="text-[11px] font-bold text-slate-500 leading-relaxed font-noto">{n.desc}</p>
                          </div>
                       </div>
                    </div>
                 )) : (
                   <div className="py-12 text-center">
                      <Bell size={40} className="mx-auto text-slate-200 mb-4" />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('no_notifications', lang)}</p>
                   </div>
                 )}
              </div>

              <div className="p-4 border-t border-slate-50 bg-slate-50/50">
                 <button 
                  onClick={() => setShowNotifications(false)} 
                  className="w-full py-3.5 bg-white border border-slate-200 text-[#2E0B5E] font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-sm active:scale-95 transition-all"
                 >
                   {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
