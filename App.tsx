
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
import { WifiOff, Loader2, RefreshCw, AlertTriangle, LogOut, CheckCircle } from 'lucide-react';
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
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('app_lang') as Language) || 'bn';
  });

  const APP_VERSION = "2.5.0-PREMIUM";

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

  const syncTeacherProfile = async (id: string) => {
    try {
      const { data } = await supabase
        .from('teachers')
        .select('*, madrasahs(name, logo_url)')
        .eq('id', id)
        .maybeSingle();
      
      if (data && data.is_active) {
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
      } else if (data && !data.is_active) {
        logout();
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const initializeSession = async () => {
      const savedTeacher = localStorage.getItem('teacher_session');
      if (savedTeacher) {
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
      }

      const { data: { session: currentSession } } = await (supabase.auth as any).getSession();
      setSession(currentSession);
      if (currentSession) {
        await fetchMadrasahProfile(currentSession.user.id);
      } else {
        setLoading(false);
      }
    };

    initializeSession();

    const { data: { subscription } } = (supabase.auth as any).onAuthStateChange((_event: any, session: any) => {
      setSession(session);
      if (session) {
        setLoading(true);
        fetchMadrasahProfile(session.user.id);
      } else {
        if (!localStorage.getItem('teacher_session')) {
          setMadrasah(null);
        }
        setLoading(false);
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
      } else if (retryCount < 5) {
        console.log(`Profile not found, retrying... (${retryCount + 1}/5)`);
        setTimeout(() => fetchMadrasahProfile(userId, retryCount + 1), 1000);
      } else {
        setMadrasah(null);
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
        // ম্যানুয়ালি ডাটাবেসে রিকোয়েস্ট পাঠিয়ে প্রোফাইল তৈরি করা
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

  const logout = () => {
    localStorage.removeItem('teacher_session');
    if (session) {
      (supabase.auth as any).signOut();
    } else {
      window.location.reload();
    }
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
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#9D50FF] text-white">
        <div className="relative">
           <Loader2 className="animate-spin text-white mb-4" size={50} />
           <RefreshCw className="absolute inset-0 m-auto animate-pulse opacity-20" size={20} />
        </div>
        <p className="font-black text-[10px] uppercase tracking-[0.2em] opacity-40">Syncing Profile Data...</p>
      </div>
    );
  }

  if (!session && !teacher) return <Auth lang={lang} />;

  // প্রোফাইল না পাওয়া গেলে স্পেশাল এরর স্ক্রিন
  if (session && !madrasah && !loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#9D50FF] px-10 text-white text-center">
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
