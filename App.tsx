
import React, { useState, useEffect } from 'react';
import { supabase, offlineApi } from './supabase';
import Auth from './pages/Auth';
import Layout from './components/Layout';
import Home from './pages/Home';
import Classes from './pages/Classes';
import Students from './pages/Students';
import StudentDetails from './pages/StudentDetails';
import StudentForm from './pages/StudentForm';
import Account from './pages/Account';
import AdminPanel from './pages/AdminPanel';
import WalletSMS from './pages/WalletSMS';
import DataManagement from './pages/DataManagement';
import Teachers from './pages/Teachers';
import { View, Class, Student, Language, Madrasah, Teacher } from './types';
import { WifiOff, Loader2, RefreshCw, AlertTriangle, LogOut, CheckCircle, BookOpen, ShieldCheck, Zap, Sparkles, ShieldAlert, Phone, CloudOff, Layers, Fingerprint, SignalLow, PhoneCall } from 'lucide-react';
import { t } from './translations';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [view, setView] = useState<View>('home');
  const [madrasah, setMadrasah] = useState<Madrasah | null>(null);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [dataVersion, setDataVersion] = useState(0); 
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('app_lang') as Language) || 'bn';
  });

  const APP_VERSION = "2.5.1-PREMIUM";

  const triggerRefresh = () => {
    setDataVersion(prev => prev + 1);
  };

  useEffect(() => {
    const handleStatusChange = () => {
      setIsOnline(navigator.onLine);
      if (navigator.onLine) {
        offlineApi.processQueue();
      }
    };
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  // Realtime Status Monitor for Live Blocking
  useEffect(() => {
    if (!madrasah?.id && !teacher?.id) return;

    // Monitor Madrasah status
    const mTargetId = teacher ? teacher.madrasah_id : madrasah?.id;
    
    const madrasahChannel = supabase
      .channel('live-status-m')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'madrasahs',
          filter: `id=eq.${mTargetId}`,
        },
        (payload) => {
          const updated = payload.new as Madrasah;
          setMadrasah(prev => prev ? { ...prev, is_active: updated.is_active } : null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(madrasahChannel);
    };
  }, [madrasah?.id, teacher?.id]);

  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setLoadingPhase(prev => (prev + 1) % 3);
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [loading]);

  const syncTeacherProfile = async (id: string) => {
    try {
      const { data } = await supabase
        .from('teachers')
        .select('*, madrasahs(name, logo_url, is_active)')
        .eq('id', id)
        .maybeSingle();
      
      if (data && data.is_active && data.madrasahs?.is_active) {
        setTeacher(data);
        localStorage.setItem('teacher_session', JSON.stringify(data));
        
        const madrasahProfile: Madrasah = { 
          id: data.madrasah_id, 
          name: data.madrasahs?.name || 'Madrasah Contact', 
          logo_url: data.madrasahs?.logo_url,
          is_super_admin: false,
          balance: 0,
          sms_balance: 0,
          is_active: true,
          created_at: data.created_at
        };
        setMadrasah(madrasahProfile);
        offlineApi.setCache('profile', madrasahProfile);
      }
    } catch (e) {
      console.error("Teacher profile sync failed:", e);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      // 1. Immediately check for cached teacher session
      const savedTeacher = localStorage.getItem('teacher_session');
      const cachedProfile = offlineApi.getCache('profile');
      
      if (savedTeacher) {
        try {
          const teacherData = JSON.parse(savedTeacher);
          setTeacher(teacherData);
          if (cachedProfile) setMadrasah(cachedProfile);
          
          setLoading(false); // Stop loading early if we have a teacher session
          
          if (navigator.onLine) syncTeacherProfile(teacherData.id);
          return;
        } catch (e) {
          localStorage.removeItem('teacher_session');
        }
      }

      // 2. Check for existing Supabase session
      const { data: { session: currentSession } } = await (supabase.auth as any).getSession();
      
      if (currentSession) {
        setSession(currentSession);
        if (cachedProfile) setMadrasah(cachedProfile);
        
        await fetchMadrasahProfile(currentSession.user.id);
        setLoading(false);
      } else {
        // Only if absolutely no session is found, show login
        setLoading(false);
      }
    };

    initializeAuth();

    // Listener for auth state changes
    const { data: { subscription } } = (supabase.auth as any).onAuthStateChange((event: string, session: any) => {
      // Avoid flapping: only set null if the event is a definitive SIGNED_OUT
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setMadrasah(null);
        setTeacher(null);
        offlineApi.removeCache('profile');
        localStorage.removeItem('teacher_session');
      } else if (session) {
        setSession(session);
        fetchMadrasahProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchMadrasahProfile = async (userId: string) => {
    try {
      const { data } = await supabase.from('madrasahs').select('*').eq('id', userId).maybeSingle();
      if (data) {
        setMadrasah(data);
        offlineApi.setCache('profile', data);
      }
    } catch (err) {
      console.error("fetchMadrasahProfile error:", err);
    }
  };

  const logout = async () => {
    localStorage.removeItem('teacher_session');
    offlineApi.removeCache('profile');
    if (session) await (supabase.auth as any).signOut();
    window.location.reload();
  };

  if (loading) {
    const messages = [
      lang === 'bn' ? 'সিকিউর কানেকশন তৈরি হচ্ছে...' : 'Establishing Secure Connection...',
      lang === 'bn' ? 'প্রোফাইল ডাটা সিঙ্ক করা হচ্ছে...' : 'Syncing Profile Data...',
      lang === 'bn' ? 'আপনার ড্যাশবোর্ড সাজানো হচ্ছে...' : 'Preparing Your Dashboard...'
    ];

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#9D50FF] relative overflow-hidden mesh-bg-vibrant">
        <div className="relative z-10 flex flex-col items-center max-w-sm w-full px-8">
          <div className="glass-card w-64 h-64 flex flex-col items-center justify-center relative overflow-hidden group">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <div className="absolute inset-0 border-[3px] border-dashed border-white/20 rounded-full animate-[spin_10s_linear_infinite]"></div>
              <div className="relative w-14 h-14 bg-white rounded-3xl flex items-center justify-center shadow-2xl z-10">
                <BookOpen size={28} className="text-brand-purple" />
              </div>
            </div>
            <div className="mt-8 flex flex-col items-center gap-1.5">
               <span className="text-white font-black text-[12px] uppercase tracking-[0.5em] ml-[0.5em] opacity-90">DEENORA</span>
               <div className="w-12 h-1 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white w-full animate-[shimmer-fast_2s_infinite_linear]"></div>
               </div>
            </div>
          </div>
          <div className="mt-12 text-center h-12">
            <p className="font-bold text-white/80 text-[14px] font-noto tracking-wide animate-in fade-in duration-700" key={loadingPhase}>
              {messages[loadingPhase]}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Improved Full Screen Offline Interface
  if (!isOnline && !madrasah) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#080A12] px-8 text-center mesh-bg-vibrant">
        <div className="glass-card p-10 max-w-sm w-full space-y-8 animate-in zoom-in-95 duration-500">
           <div className="w-24 h-24 bg-white/10 rounded-[2.5rem] flex items-center justify-center mx-auto border-2 border-white/20 shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-white/5 animate-pulse"></div>
              <WifiOff size={48} className="text-white relative z-10 animate-pulse" />
           </div>
           
           <div className="space-y-3">
              <h2 className="text-2xl font-black text-white font-noto">ইন্টারনেট সংযোগ নেই</h2>
              <p className="text-[13px] font-bold text-white/60 font-noto leading-relaxed">
                আপনার ডিভাইসে ইন্টারনেট সংযোগ পাওয়া যাচ্ছে না। পূর্বের সেভ করা ডাটা দেখতে ইন্টারনেট সংযোগ চালু করুন অথবা অফলাইন মোড ব্যবহার করুন।
              </p>
           </div>

           <div className="space-y-4 pt-4">
              <button 
                onClick={() => window.location.reload()} 
                className="w-full py-5 bg-white text-brand-purple font-black rounded-[2rem] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
              >
                <RefreshCw size={20} /> পুনরায় চেষ্টা করুন
              </button>
              
              <div className="flex items-center gap-2 justify-center opacity-40">
                 <SignalLow size={14} className="text-white" />
                 <span className="text-[10px] font-black text-white uppercase tracking-widest">Searching for network...</span>
              </div>
           </div>
        </div>
        
        <div className="mt-12 space-y-2 opacity-50">
           <p className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Deenora Madrasah Management</p>
           <p className="text-[8px] font-bold text-white uppercase tracking-widest">Version {APP_VERSION}</p>
        </div>
      </div>
    );
  }

  if (!session && !teacher) return <Auth lang={lang} />;

  if (madrasah && madrasah.is_active === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#080A12] px-10 text-white text-center">
        <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mb-8 border-4 border-red-500/30">
           <ShieldAlert size={48} className="text-red-500" />
        </div>
        <h3 className="text-2xl font-black font-noto mb-4 text-red-500">অ্যাকাউন্ট স্থগিত</h3>
        <p className="text-sm font-bold opacity-80 font-noto leading-relaxed mb-10 max-w-xs mx-auto">
          আপনার পোর্টালে প্রবেশাধিকার সাময়িকভাবে বন্ধ করা হয়েছে। বিস্তারিত জানতে অ্যাডমিনের সাথে যোগাযোগ করুন।
        </p>
        <div className="w-full space-y-4 max-w-xs mx-auto">
           <a href="tel:01700000000" className="w-full py-5 bg-white text-[#080A12] font-black rounded-[2rem] flex items-center justify-center gap-3 uppercase tracking-widest text-sm"><PhoneCall size={20} /> সাপোর্ট কল</a>
           <button onClick={logout} className="w-full py-4 bg-transparent text-white font-bold rounded-[2rem] border border-white/20 uppercase tracking-widest text-xs">লগ আউট</button>
        </div>
      </div>
    );
  }

  const navigateTo = (newView: View) => {
    if (teacher) {
      const perms = teacher.permissions;
      if (newView === 'classes' && !perms.can_manage_classes && !perms.can_manage_students) return;
      if (newView === 'wallet-sms' && !perms.can_send_sms) return;
      if (['admin-panel', 'admin-dashboard', 'admin-approvals'].includes(newView)) return;
    }
    triggerRefresh();
    setView(newView);
  };

  return (
    <div className="relative h-full w-full bg-transparent">
      {(!isOnline || syncing) && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[1000] animate-in slide-in-from-top-10">
          <div className="bg-[#1A0B2E]/90 backdrop-blur-2xl border border-white/20 rounded-full px-6 py-2.5 flex items-center gap-3 shadow-2xl">
            {syncing ? (
               <><RefreshCw size={14} className="animate-spin text-white" /><span className="text-[10px] font-black text-white uppercase tracking-widest">Syncing...</span></>
            ) : (
               <><div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse"></div><span className="text-[10px] font-black text-white uppercase tracking-widest">Offline Storage Mode</span></>
            )}
          </div>
        </div>
      )}
      
      <Layout 
        currentView={view} 
        setView={navigateTo} 
        lang={lang} 
        madrasah={madrasah}
        teacher={teacher}
      >
        {view === 'home' && (
          madrasah?.is_super_admin ? <AdminPanel lang={lang} currentView="list" dataVersion={dataVersion} /> : 
          <Home 
            onStudentClick={(s) => { setSelectedStudent(s); setView('student-details'); }} 
            lang={lang} 
            dataVersion={dataVersion} 
            triggerRefresh={triggerRefresh}
            madrasahId={madrasah?.id}
          />
        )}
        
        {view === 'classes' && <Classes onClassClick={(cls) => { setSelectedClass(cls); setView('students'); }} lang={lang} madrasah={madrasah} dataVersion={dataVersion} triggerRefresh={triggerRefresh} readOnly={!!teacher && !teacher.permissions.can_manage_classes} />}
        {view === 'students' && selectedClass && <Students selectedClass={selectedClass} onStudentClick={(s) => { setSelectedStudent(s); setView('student-details'); }} onAddClick={() => { setSelectedStudent(null); setIsEditing(false); setView('student-form'); }} onBack={() => setView('classes')} lang={lang} dataVersion={dataVersion} triggerRefresh={triggerRefresh} canAdd={!teacher || teacher.permissions.can_manage_students} canSendSMS={!teacher || (teacher.permissions.can_send_sms || teacher.permissions.can_send_free_sms)} teacher={teacher} madrasahId={madrasah?.id} onNavigateToWallet={() => setView('wallet-sms')} />}
        {view === 'student-details' && selectedStudent && <StudentDetails student={selectedStudent} onEdit={() => { setIsEditing(true); setView('student-form'); }} onBack={() => setView(selectedClass ? 'students' : 'home')} lang={lang} readOnly={!!teacher && !teacher.permissions.can_manage_students} madrasahId={madrasah?.id} triggerRefresh={triggerRefresh} />}
        {view === 'student-form' && <StudentForm student={selectedStudent} madrasah={madrasah} defaultClassId={selectedClass?.id} isEditing={isEditing} onSuccess={() => { triggerRefresh(); setView(selectedClass ? 'students' : 'home'); }} onCancel={() => setView(selectedStudent ? 'student-details' : (selectedClass ? 'students' : 'home'))} lang={lang} />}
        {view === 'wallet-sms' && <WalletSMS lang={lang} madrasah={madrasah} triggerRefresh={triggerRefresh} dataVersion={dataVersion} />}
        {view === 'teachers' && <Teachers lang={lang} madrasah={madrasah} onBack={() => setView('account')} />}
        {view === 'data-management' && <DataManagement lang={lang} madrasah={madrasah} onBack={() => setView('account')} triggerRefresh={triggerRefresh} />}
        {view === 'account' && <Account lang={lang} setLang={(l) => { setLang(l); localStorage.setItem('app_lang', l); }} onProfileUpdate={() => triggerRefresh()} setView={setView} isSuperAdmin={madrasah?.is_super_admin} initialMadrasah={madrasah} onLogout={logout} isTeacher={!!teacher} />}
        {madrasah?.is_super_admin && view === 'admin-dashboard' && <AdminPanel lang={lang} currentView="dashboard" dataVersion={dataVersion} />}
        {madrasah?.is_super_admin && view === 'admin-approvals' && <AdminPanel lang={lang} currentView="approvals" dataVersion={dataVersion} />}
        
        <div className="mt-8 mb-4 text-center opacity-30 select-none">
           <span className="text-[9px] font-black text-white uppercase tracking-widest">{APP_VERSION}</span>
           <p className="text-[8px] font-bold text-white uppercase tracking-widest mt-1">{t('copyright', lang)}</p>
        </div>
      </Layout>
    </div>
  );
};

export default App;
