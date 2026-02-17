
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
import { WifiOff, Loader2, RefreshCw, AlertTriangle, LogOut, CheckCircle, BookOpen, ShieldCheck, Zap, Sparkles, ShieldAlert, Phone, CloudOff, Layers, Fingerprint } from 'lucide-react';
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

  // Realtime Status Monitor for Live Blocking
  useEffect(() => {
    if (!madrasah?.id && !teacher?.id) return;

    // 1. Monitor Madrasah status (Affects both Admins and Teachers)
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

    // 2. Monitor Teacher specific status (If logged in as teacher)
    let teacherChannel: any = null;
    if (teacher?.id) {
      teacherChannel = supabase
        .channel('live-status-t')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'teachers',
            filter: `id=eq.${teacher.id}`,
          },
          (payload) => {
            const updated = payload.new as Teacher;
            setTeacher(prev => prev ? { ...prev, is_active: updated.is_active } : null);
            if (updated.is_active === false) {
               setMadrasah(prev => prev ? { ...prev, is_active: false } : null);
            }
          }
        )
        .subscribe();
    }

    return () => {
      supabase.removeChannel(madrasahChannel);
      if (teacherChannel) supabase.removeChannel(teacherChannel);
    };
  }, [madrasah?.id, teacher?.id]);

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
        setMadrasah(prev => prev ? { ...prev, is_active: false } : { is_active: false } as Madrasah);
        setLoading(false);
      }
    } catch (e) {
      console.error("Teacher profile sync failed:", e);
    }
  };

  useEffect(() => {
    const initializeSession = async () => {
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
          localStorage.removeItem('teacher_session');
        }
      }

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
        <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none">
          <div className="absolute top-[10%] left-[5%] w-72 h-72 bg-white rounded-full blur-[100px] animate-pulse"></div>
          <div className="absolute bottom-[10%] right-[5%] w-96 h-96 bg-brand-lavender rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        <div className="relative z-10 flex flex-col items-center max-w-sm w-full px-8">
          <div className="glass-card w-64 h-64 flex flex-col items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-white/5 group-hover:bg-white/10 transition-colors duration-500"></div>
            
            <div className="relative w-32 h-32 flex items-center justify-center">
              <div className="absolute inset-0 border-[3px] border-dashed border-white/20 rounded-full animate-[spin_10s_linear_infinite]"></div>
              <div className="absolute inset-2 border-[2px] border-white/10 rounded-full animate-pulse"></div>
              <div className="relative w-14 h-14 bg-white rounded-3xl flex items-center justify-center shadow-2xl z-10">
                <BookOpen size={28} className="text-brand-purple" />
              </div>
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 flex gap-1">
                 <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce"></div>
                 <div className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                 <div className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>

            <div className="mt-8 flex flex-col items-center gap-1.5">
               <span className="text-white font-black text-[12px] uppercase tracking-[0.5em] ml-[0.5em] opacity-90">DEENORA</span>
               <div className="w-12 h-1 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white w-full animate-[shimmer-fast_2s_infinite_linear]"></div>
               </div>
            </div>
          </div>
          
          <div className="mt-12 text-center h-12 flex items-center justify-center">
            <p className="font-bold text-white/80 text-[14px] font-noto tracking-wide animate-in fade-in slide-in-from-bottom-2 duration-700" key={loadingPhase}>
              {messages[loadingPhase]}
            </p>
          </div>
        </div>

        <div className="absolute bottom-10 left-0 right-0 text-center opacity-30">
          <p className="text-[10px] font-black text-white uppercase tracking-[0.4em]">Optimized for Performance</p>
        </div>
      </div>
    );
  }

  if (!session && !teacher) return <Auth lang={lang} />;

  // Account Suspended Screen
  if (madrasah && madrasah.is_active === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#080A12] px-10 text-white text-center animate-in fade-in duration-500">
        <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mb-8 border-4 border-red-500/30 animate-pulse">
           <ShieldAlert size={48} className="text-red-500" />
        </div>
        <h3 className="text-2xl font-black font-noto mb-4 text-red-500">অ্যাকাউন্ট স্থগিত করা হয়েছে</h3>
        <p className="text-sm font-bold opacity-80 font-noto leading-relaxed mb-10 max-w-xs mx-auto">
          দুঃখিত, আপনার পোর্টালে প্রবেশাধিকার সাময়িকভাবে বন্ধ করা হয়েছে। বিস্তারিত জানতে বা পুনরায় চালু করতে অ্যাডমিনের সাথে যোগাযোগ করুন।
        </p>
        
        <div className="w-full space-y-4 max-w-xs">
          <a 
            href="tel:01700000000" 
            className="w-full py-5 bg-white text-[#080A12] font-black rounded-[2rem] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
          >
            <Phone size={20} /> সাপোর্ট কল করুন
          </a>
          
          <button 
            onClick={logout} 
            className="w-full py-4 bg-transparent text-white font-bold rounded-[2rem] border border-white/20 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
          >
            <LogOut size={16} /> লগ আউট
          </button>
        </div>
      </div>
    );
  }

  // Profile not found / Offline Sync issue screen
  if (session && !madrasah && !loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#9D50FF] px-8 text-white text-center mesh-bg-vibrant relative">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <CloudOff size={300} className="absolute -top-10 -right-10 rotate-12" />
        </div>

        <div className="glass-card w-full max-w-sm p-10 flex flex-col items-center">
          <div className="w-24 h-24 bg-white/20 rounded-[2rem] flex items-center justify-center mb-8 border-2 border-white/40 shadow-2xl">
             <Layers size={48} className="text-white animate-bounce" />
          </div>
          <h3 className="text-2xl font-black font-noto mb-4 tracking-tight">প্রোফাইল তথ্য নেই!</h3>
          <p className="text-[13px] font-bold text-white/70 font-noto leading-relaxed mb-10">
            আপনার ইমেইল দিয়ে কোনো মাদ্রাসা প্রোফাইল খুঁজে পাওয়া যায়নি। সার্ভার বা ইন্টারনেট জনিত সমস্যার কারণে এমন হতে পারে।
          </p>
          
          <div className="w-full space-y-4">
            <button 
              onClick={handleManualSync} 
              disabled={syncing}
              className="w-full py-5 bg-white text-brand-purple font-black rounded-3xl shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
            >
              {syncing ? <Loader2 className="animate-spin" /> : <RefreshCw size={20} />} 
              পুনরায় চেষ্টা করুন
            </button>
            
            <button 
              onClick={logout} 
              className="w-full py-4 bg-white/10 text-white font-black rounded-3xl border border-white/20 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
            >
              <LogOut size={16} /> লগ আউট করুন
            </button>
          </div>
        </div>
        
        <div className="mt-8 flex items-center gap-2 opacity-40">
           <Fingerprint size={14} />
           <span className="text-[10px] font-black uppercase tracking-widest">System Identifier Error</span>
        </div>
      </div>
    );
  }

  const isSuperAdmin = madrasah?.is_super_admin === true;

  return (
    <div className="relative h-full w-full bg-transparent">
      {(!isOnline || syncing) && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[1000] animate-in slide-in-from-top-10">
          <div className="bg-white/20 backdrop-blur-2xl border border-white/30 rounded-full px-6 py-2.5 flex items-center gap-3 shadow-2xl">
            {syncing ? (
               <>
                 <RefreshCw size={14} className="animate-spin text-white" />
                 <span className="text-[10px] font-black text-white uppercase tracking-widest">Syncing Data...</span>
               </>
            ) : (
               <>
                 <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></div>
                 <span className="text-[10px] font-black text-white uppercase tracking-widest">Offline Mode</span>
               </>
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
            onNavigateToWallet={() => setView('wallet-sms')}
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
