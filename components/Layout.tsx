
import React from 'react';
import { Home, User, BookOpen, Wallet, ShieldCheck, BarChart3, CreditCard, RefreshCw, Smartphone } from 'lucide-react';
import { View, Language, Madrasah, Teacher } from '../types';
import { t } from '../translations';

interface LayoutProps {
  // Use React.ReactNode instead of React.Node for children type
  children: React.ReactNode;
  currentView: View;
  setView: (view: View) => void;
  lang: Language;
  madrasah: Madrasah | null;
  onUpdateClick?: () => void;
  teacher?: Teacher | null;
}

const Layout: React.FC<LayoutProps> = ({ children, currentView, setView, lang, madrasah, onUpdateClick, teacher }) => {
  const isSuperAdmin = madrasah?.is_super_admin === true;

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
      {/* Header with lower priority stack */}
      <header className="flex-none px-6 pt-[calc(env(safe-area-inset-top)+8px)] pb-3 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="w-11 h-11 rounded-[1rem] flex items-center justify-center bg-white shadow-sm border border-white/20 shrink-0 overflow-hidden">
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
        
        <button onClick={() => window.location.reload()} className="p-2.5 bg-white/20 backdrop-blur-md rounded-[1rem] text-white active:scale-95 transition-all border border-white/20 shadow-xl ml-3">
          <RefreshCw size={18} />
        </button>
      </header>

      {/* Main Scrollable Content */}
      <main className="flex-1 overflow-y-auto px-5 pt-2 pb-40 w-full max-w-md mx-auto scroll-smooth custom-scrollbar">
        {children}
      </main>

      {/* Navigation - Needs higher stack than page content but lower than modals */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[94%] max-w-sm z-[50]">
        <nav className="bg-white/95 backdrop-blur-[25px] border border-white/50 flex justify-around items-center py-3 px-2 rounded-[2.5rem] shadow-[0_20px_50px_-10px_rgba(46,11,94,0.3)]">
          <button onClick={() => setView('home')} className={`relative flex flex-col items-center gap-0.5 transition-all flex-1 ${isTabActive('home') ? 'text-[#8D30F4]' : 'text-[#A179FF]'}`}>
            <Home size={22} strokeWidth={isTabActive('home') ? 3 : 2} />
            <span className={`text-[10px] font-black font-noto ${isTabActive('home') ? 'opacity-100' : 'opacity-60'}`}>{t('home', lang)}</span>
            {isTabActive('home') && <div className="absolute -top-1 w-1 h-1 rounded-full bg-[#8D30F4]"></div>}
          </button>
          
          {isSuperAdmin ? (
            <>
              <button onClick={() => setView('admin-approvals')} className={`relative flex flex-col items-center gap-0.5 transition-all flex-1 ${isTabActive('approvals') ? 'text-[#8D30F4]' : 'text-[#A179FF]'}`}>
                <CreditCard size={22} strokeWidth={isTabActive('approvals') ? 3 : 2} />
                <span className={`text-[10px] font-black font-noto ${isTabActive('approvals') ? 'opacity-100' : 'opacity-60'}`}>{t('approvals', lang)}</span>
                {isTabActive('approvals') && <div className="absolute -top-1 w-1 h-1 rounded-full bg-[#8D30F4]"></div>}
              </button>
              <button onClick={() => setView('admin-dashboard')} className={`relative flex flex-col items-center gap-0.5 transition-all flex-1 ${isTabActive('dashboard') ? 'text-[#8D30F4]' : 'text-[#A179FF]'}`}>
                <BarChart3 size={22} strokeWidth={isTabActive('dashboard') ? 3 : 2} />
                <span className={`text-[10px] font-black font-noto ${isTabActive('dashboard') ? 'opacity-100' : 'opacity-60'}`}>{t('dashboard', lang)}</span>
                {isTabActive('dashboard') && <div className="absolute -top-1 w-1 h-1 rounded-full bg-[#8D30F4]"></div>}
              </button>
            </>
          ) : (
            <>
              {canSeeClasses && (
                <button onClick={() => setView('classes')} className={`relative flex flex-col items-center gap-0.5 transition-all flex-1 ${isTabActive('classes') ? 'text-[#8D30F4]' : 'text-[#A179FF]'}`}>
                  <Smartphone size={22} strokeWidth={isTabActive('classes') ? 3 : 2} />
                  <span className={`text-[10px] font-black font-noto ${isTabActive('classes') ? 'opacity-100' : 'opacity-60'}`}>ক্লাস</span>
                  {isTabActive('classes') && <div className="absolute -top-1 w-1 h-1 rounded-full bg-[#8D30F4]"></div>}
                </button>
              )}
              {canSeeWallet && (
                <button onClick={() => setView('wallet-sms')} className={`relative flex flex-col items-center gap-0.5 transition-all flex-1 ${isTabActive('wallet') ? 'text-[#8D30F4]' : 'text-[#A179FF]'}`}>
                  <Wallet size={22} strokeWidth={isTabActive('wallet') ? 3 : 2} />
                  <span className={`text-[10px] font-black font-noto ${isTabActive('wallet') ? 'opacity-100' : 'opacity-60'}`}>এসএমএস</span>
                  {isTabActive('wallet') && <div className="absolute -top-1 w-1 h-1 rounded-full bg-[#8D30F4]"></div>}
                </button>
              )}
            </>
          )}
          
          <button onClick={() => setView('account')} className={`relative flex flex-col items-center gap-0.5 transition-all flex-1 ${isTabActive('account') ? 'text-[#8D30F4]' : 'text-[#A179FF]'}`}>
            <User size={22} strokeWidth={isTabActive('account') ? 3 : 2} />
            <span className={`text-[10px] font-black font-noto ${isTabActive('account') ? 'opacity-100' : 'opacity-60'}`}>{t('account', lang)}</span>
            {isTabActive('account') && <div className="absolute -top-1 w-1 h-1 rounded-full bg-[#8D30F4]"></div>}
          </button>
        </nav>
      </div>
    </div>
  );
};

export default Layout;
