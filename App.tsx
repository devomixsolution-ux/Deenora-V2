
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
import { WifiOff, Loader2, RefreshCw, AlertTriangle, LogOut, CheckCircle, BookOpen, ShieldCheck, Zap, Sparkles, ShieldAlert, Phone } from 'lucide-react';
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
    const handleStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  // Message cycle for loading screen
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
        setMadrasah({ 
          id: data.madrasah_id, 
          name: data.madrasahs?.name || 'Madrasah Contact', 
          logo_url: data.madrasahs?.logo_url,
          is_super_admin: false,
          balance: 0,
          sms_balance: 0,
          is_active: true,
          created_at: data.created_at
        } as Madrasah);
      } else if (data && (!data.is_active || !data.madrasahs?.is_active)) {
        // Handle teacher or parent madrasah being inactive
        setMadrasah(prev => prev ? { ...prev, is_active: false } : null);
      }
    } catch (e) {
      console.error("Teacher profile sync failed:", e);
    }
  };

  useEffect(() => {
    const initializeSession = async () => {
      // 1. Check for Teacher session first
      const savedTeacher = localStorage.getItem('teacher_session');
      if (savedTeacher) {
        try {
          const teacherData = JSON.parse(savedTeacher);
          setTeacher(teacherData);
          setMadrasah({ 
            id: teacherData.madrasah_id, 
            name: teacherData.madrasahs?.name || 'Madrasah Contact', 
            logo_url: teacherData.madrasahs?.logo_url,
            is_super_admin: false,
            balance: 0,
            sms_balance: 0,
            is_active: true,
            created_at: teacherData.created_at
          } as Madrasah);
          if (navigator.onLine) await syncTeacherProfile(teacherData.id);
          setLoading(false);
          return;
        } catch (e) {
          console.error("Corrupt teacher session");
          localStorage.removeItem('teacher_session');
        }
      }

      // 2. Check for Admin Supabase session
      const { data: { session: currentSession } } = await (supabase.auth as any).getSession();
      setSession(currentSession);
      
      if (currentSession) {
        await fetchMadrasahProfile(currentSession.user.id);
      } else {
        const cachedProfile = offlineApi.getCache('profile');
        if (cachedProfile) {
          setMadrasah(cachedProfile);
        }
        setLoading(false);
      }
    };

    initializeSession();

    const { data: { subscription } } = (supabase.auth as any).onAuthStateChange((event: string, session: any) => {
      setSession(session);
      
      if (session) {
        setLoading(true);
        fetchMadrasahProfile(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        if (!localStorage.getItem('teacher_session')) {
          setMadrasah(null);
          setView('home');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchMadrasahProfile = async (userId: string, retryCount = 0) => {
    try {
      const { data, error } = await supabase.from('madrasahs').select('*').eq('id', userId).maybeSingle();
      
      if (data) {
        setMadrasah(data);
        offlineApi.setCache('profile', data);
        setLoading(false);
      } else if (error && retryCount < 3) {
        setTimeout(() => fetchMadrasahProfile(userId, retryCount + 1), 1500);
      } else {
        if (!madrasah) setMadrasah(null);
        setLoading(false);
      }
    } catch (err) {
      console.error("fetchMadrasahProfile error:", err);
      setLoading(false);
    }
  };

  const handleManualSync = async () => {
    if (!session?.user) return;
    setSyncing(true);
    try {
      const { data: existing } = await supabase.from('madrasahs').select('id').eq('id', session.user.id).maybeSingle();
      
      if (!existing) {
        const { error: insertError } = await supabase.from('madrasahs').insert({
          id: session.user.id,
          email: session.user.email,
          name: session.user.email?.split('@')[0] || 'New Madrasah',
          is_active: true,
          is_super_admin: false
        });
        if (insertError) throw insertError;
      }
      await fetchMadrasahProfile(session.user.id);
    } catch (err: any) {
      alert(lang === 'bn' ? 'সিঙ্ক ব্যর্থ হয়েছে: ' + err.message : 'Sync Failed: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const logout = async () => {
    localStorage.removeItem('teacher_session');
    localStorage.removeItem('m_name');
    offlineApi.removeCache('profile');
    
    if (session) {
      await (supabase.auth as any).signOut();
    }
    
    setMadrasah(null);
    setTeacher(null);
    setSession(null);
    setView('home');
    window.location.reload();
  };

  const navigateTo = (newView: View) => {
    if (teacher) {
      const perms = teacher.permissions;
      if (newView === 'classes' && !perms.can_manage_classes && !perms.can_manage_students) return;
      if (newView === 'wallet-sms' && !perms.can_send_sms && !perms.can_send_free_sms) return;
      if (['admin-panel', 'admin-dashboard', 'admin-approvals'].includes(newView)) return;
    }
    triggerRefresh();
    setView(newView);
  };

  if (loading) {
    const messages = [
      lang === 'bn' ? 'সিকিউর কানেকশন তৈরি হচ্ছে...' : 'Establishing Secure Connection...',
      lang === 'bn' ? 'প্রোফাইল ডাটা সিঙ্ক করা হচ্ছে...' : 'Syncing Profile Data...',
      lang === 'bn' ? 'আপনার ড্যাশবোর্ড সাজানো হচ্ছে...' : 'Preparing Your Dashboard...'
    ];

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#9D50FF] relative overflow-hidden mesh-bg-vibrant">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#8D30F4] rounded-full blur-[120px] opacity-40 animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#A179FF] rounded-full blur-[120px] opacity-40 animate-pulse" style={{ animationDelay: '1s' }}></div>

        <div className="relative z-10 flex flex-col items-center">
          <div className="relative w-40 h-40 flex items-center justify-center">
            <div className="absolute inset-0 border-[3px] border-dashed border-white/20 rounded-full animate-[spin_8s_linear_infinite]"></div>
            <div className="absolute inset-4 border-[4px] border-white/30 rounded-full animate-[ping_3s_ease-in-out_infinite] opacity-20"></div>
            <div className="absolute inset-8 border-t-[5px] border-r-[5px] border-white border-solid rounded-full animate-spin shadow-[0_0_20px_rgba(255,255,255,0.4)]"></div>
            <div className="relative w-16 h-16 bg-white rounded-[1.8rem] flex items-center justify-center shadow-2xl animate-[pulse_2s_ease-in-out_infinite] border-2 border-white/50">
              <BookOpen size={32} className="text-[#8D30F4]" />
            </div>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-4 animate-bounce">
              <Sparkles size={16} className="text-white/40" />
            </div>
          </div>

          <div className="mt-12 text-center space-y-4 px-10">
            <div className="flex flex-col items-center gap-1">
              <span className="text-white font-black text-[11px] uppercase tracking-[0.6em] ml-[0.6em] opacity-90 drop-shadow-lg">
                DEENORA
              </span>
              <div className="w-8 h-1 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white w-1/2 animate-[shimmer_1.5s_infinite_linear]"></div>
              </div>
            </div>
            
            <div className="h-10 flex items-center justify-center">
              <p className="font-bold text-white/70 text-[13px] font-noto tracking-wide animate-in fade-in slide-in-from-bottom-2 duration-700" key={loadingPhase}>
                {messages[loadingPhase]}
              </p>
            </div>
          </div>
        </div>

        <div className="absolute bottom-10 left-0 right-0 text-center opacity-30">
          <p className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Authorized System Only</p>
        </div>

        <style>{`
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
          }
        `}</style>
      </div>
    );
  }

  if (!session && !teacher) return <Auth lang={lang} />;

  // Account Suspended Screen
  if (madrasah && madrasah.is_active === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#080A12] px-10 text-white text-center">
        <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mb-8 border-4 border-red-500/30 animate-pulse">
           <ShieldAlert size={48} className="text-red-500" />
        </div>
        <h3 className="text-2xl font-black font-noto mb-4 text-red-500">অ্যাকাউন্ট স্থগিত করা হয়েছে</h3>
        <p className="text-sm font-bold opacity-80 font-noto leading-relaxed mb-10 max-w-xs mx-auto">
          দুঃখিত, আপনার মাদরাসার পোর্টালে প্রবেশাধিকার সাময়িকভাবে বন্ধ করা হয়েছে। বিস্তারিত জানতে বা পুনরায় চালু করতে অ্যাডমিনের সাথে যোগাযোগ করুন।
        </p>
        
        <div className="w-full space-y-4 max-w-xs">
          <a 
            href="tel:01700000000" 
            className="w-full py-5 bg-white text-[#080A12] font-black rounded-full shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
          >
            <Phone size={20} /> সাপোর্ট কল করুন
          </a>
          
          <button 
            onClick={logout} 
            className="w-full py-4 bg-transparent text-white font-bold rounded-full border border-white/20 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
          >
            <LogOut size={16} /> লগ আউট
          </button>
        </div>
      </div>
    );
  }

  // Profile not found error screen
  if (session && !madrasah && !loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#9D50FF] px-10 text-white text-center mesh-bg-vibrant">
        <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-8 border-4 border-white/30 animate-pulse">
           <AlertTriangle size={48} className="text-white" />
        </div>
        <h3 className="text-2xl font-black font-noto mb-4">প্রোফাইল পাওয়া যায়নি!</h3>
        <p className="text-sm font-bold opacity-80 font-noto leading-relaxed mb-10">
          আপনার ইমেইল দিয়ে কোনো মাদ্রাসা প্রোফাইল সিস্টেমে রেজিস্টার করা নেই। এটি হতে পারে সার্ভার সিঙ্ক্রোনাইজেশনের জন্য। নিচের বাটনে ক্লিক করে প্রোফাইল আপডেট করুন।
        </p>
        
        <div className="w-full space-y-4">
          <button 
            onClick={handleManualSync} 
            disabled={syncing}
            className="w-full py-5 bg-white text-[#9D50FF] font-black rounded-full shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
          >
            {syncing ? <Loader2 className="animate-spin" /> : <RefreshCw size={20} />} 
            প্রোফাইল সিঙ্ক করুন
          </button>
          
          <button 
            onClick={logout} 
            className="w-full py-4 bg-transparent text-white font-bold rounded-full border border-white/30 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
          >
            <LogOut size={16} /> লগ আউট করুন
          </button>
        </div>
      </div>
    );
  }

  const isSuperAdmin = madrasah?.is_super_admin === true;

  return (
    <div className="relative h-full w-full bg-transparent">
      {(!isOnline || syncing) && (
        <div className="absolute top-0 left-0 right-0 bg-white/60 backdrop-blur-md text-[#2E0B5E] text-[10px] font-black py-1.5 px-4 z-[60] flex items-center justify-center gap-2 uppercase tracking-widest border-b border-[#8D30F4]/10">
          {syncing ? <><RefreshCw size={12} className="animate-spin text-[#8D30F4]" /> Syncing Profile...</> : <><WifiOff size={10} className="text-red-400" /> Offline Mode</>}
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
          isSuperAdmin ? <AdminPanel lang={lang} currentView="list" dataVersion={dataVersion} /> : 
          <Home 
            onStudentClick={(s) => { setSelectedStudent(s); setView('student-details'); }} 
            lang={lang} 
            dataVersion={dataVersion} 
            triggerRefresh={triggerRefresh}
            madrasahId={madrasah?.id}
          />
        )}
        
        {view === 'classes' && (
          <Classes 
            onClassClick={(cls) => { setSelectedClass(cls); setView('students'); }} 
            lang={lang} 
            madrasah={madrasah} 
            dataVersion={dataVersion} 
            triggerRefresh={triggerRefresh} 
            readOnly={!!teacher && !teacher.permissions.can_manage_classes} 
          />
        )}

        {view === 'students' && selectedClass && (
          <Students 
            selectedClass={selectedClass} 
            onStudentClick={(s) => { setSelectedStudent(s); setView('student-details'); }} 
            onAddClick={() => { setSelectedStudent(null); setIsEditing(false); setView('student-form'); }} 
            onBack={() => setView('classes')} 
            lang={lang} 
            dataVersion={dataVersion} 
            triggerRefresh={triggerRefresh}
            canAdd={!teacher || teacher.permissions.can_manage_students}
            canSendSMS={!teacher || (teacher.permissions.can_send_sms || teacher.permissions.can_send_free_sms)}
            teacher={teacher}
            madrasahId={madrasah?.id}
          />
        )}

        {view === 'student-details' && selectedStudent && (
          <StudentDetails 
            student={selectedStudent} 
            onEdit={() => { setIsEditing(true); setView('student-form'); }} 
            onBack={() => setView(selectedClass ? 'students' : 'home')} 
            lang={lang} 
            readOnly={!!teacher && !teacher.permissions.can_manage_students} 
            madrasahId={madrasah?.id}
            triggerRefresh={triggerRefresh}
          />
        )}

        {view === 'student-form' && (
          <StudentForm 
            student={selectedStudent} 
            madrasah={madrasah} 
            defaultClassId={selectedClass?.id} 
            isEditing={isEditing} 
            onSuccess={() => { triggerRefresh(); setView(selectedClass ? 'students' : 'home'); }} 
            onCancel={() => setView(selectedStudent ? 'student-details' : (selectedClass ? 'students' : 'home'))} 
            lang={lang} 
          />
        )}

        {view === 'wallet-sms' && <WalletSMS lang={lang} madrasah={madrasah} triggerRefresh={triggerRefresh} dataVersion={dataVersion} />}
        {view === 'teachers' && <Teachers lang={lang} madrasah={madrasah} onBack={() => setView('account')} />}
        {view === 'data-management' && <DataManagement lang={lang} madrasah={madrasah} onBack={() => setView('account')} triggerRefresh={triggerRefresh} />}
        
        {view === 'account' && (
          <Account 
            lang={lang} 
            setLang={(l) => { setLang(l); localStorage.setItem('app_lang', l); }} 
            onProfileUpdate={() => triggerRefresh()} 
            setView={setView} 
            isSuperAdmin={isSuperAdmin} 
            initialMadrasah={madrasah} 
            onLogout={logout}
            isTeacher={!!teacher}
          />
        )}

        {isSuperAdmin && view === 'admin-dashboard' && <AdminPanel lang={lang} currentView="dashboard" dataVersion={dataVersion} />}
        {isSuperAdmin && view === 'admin-approvals' && <AdminPanel lang={lang} currentView="approvals" dataVersion={dataVersion} />}
        
        <div className="mt-8 mb-4 text-center opacity-30 select-none">
           <span className="text-[9px] font-black text-white uppercase tracking-widest">{APP_VERSION}</span>
           <p className="text-[8px] font-bold text-white uppercase tracking-widest mt-1">{t('copyright', lang)}</p>
        </div>
      </Layout>
    </div>
  );
};

export default App;
