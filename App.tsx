
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Home, 
  Clock, 
  BrainCircuit, 
  BarChart3, 
  Settings as SettingsIcon,
  Flame,
  Award,
  ChevronRight,
  Play,
  CheckCircle2,
  X,
  Calendar,
  Zap,
  RotateCcw
} from 'lucide-react';
import { 
  Language, 
  TimerMode, 
  UserProfile, 
  StudySession 
} from './types';
import { 
  SCIENCE_SUBJECTS, 
  LOCALIZATION, 
  BADGES 
} from './constants';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { GoogleGenAI } from "@google/genai";

// --- Helpers ---

const haptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
  if (!navigator.vibrate) return;
  switch(type) {
    case 'light': navigator.vibrate(10); break;
    case 'medium': navigator.vibrate(30); break;
    case 'heavy': navigator.vibrate(70); break;
  }
};

// --- Components ---

const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = "", onClick }) => (
  <div 
    onClick={onClick}
    className={`bg-white rounded-[2rem] shadow-sm border border-slate-100 p-6 ${className} ${onClick ? 'active:scale-[0.98] transition-transform' : ''}`}
  >
    {children}
  </div>
);

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'timer' | 'ai' | 'stats' | 'settings'>('home');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [activeSession, setActiveSession] = useState<{ subjectId: string; paper: number; topic: string; mode: TimerMode } | null>(null);
  const [resumePrompt, setResumePrompt] = useState<boolean>(false);

  // Load Initial Data
  useEffect(() => {
    const savedProfile = localStorage.getItem('study_streak_profile');
    const savedSessions = localStorage.getItem('study_streak_sessions');
    const savedActiveSession = localStorage.getItem('study_streak_active_timer');

    if (savedProfile) setProfile(JSON.parse(savedProfile));
    if (savedSessions) setSessions(JSON.parse(savedSessions));
    
    if (savedActiveSession) {
      setResumePrompt(true);
    }
  }, []);

  const handleResumeDecision = (accept: boolean) => {
    const saved = localStorage.getItem('study_streak_active_timer');
    if (accept && saved) {
      const data = JSON.parse(saved);
      setActiveSession(data.session);
      setTimerSeconds(data.seconds);
      setIsTimerRunning(true);
      setActiveTab('timer');
    } else {
      localStorage.removeItem('study_streak_active_timer');
    }
    setResumePrompt(false);
  };

  // Persistence
  useEffect(() => {
    if (profile) localStorage.setItem('study_streak_profile', JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem('study_streak_sessions', JSON.stringify(sessions));
  }, [sessions]);

  // Timer Effect
  useEffect(() => {
    let interval: any;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds(prev => {
          const next = prev + 1;
          if (next % 5 === 0 && activeSession) {
            localStorage.setItem('study_streak_active_timer', JSON.stringify({
              session: activeSession,
              seconds: next
            }));
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, activeSession]);

  const lang = profile?.language || Language.EN;
  const t = LOCALIZATION[lang];

  const handleOnboarding = (name: string, nickname: string, language: Language, goal: number) => {
    const newProfile: UserProfile = {
      name,
      nickname,
      language,
      dailyGoalMinutes: goal,
      onboardingComplete: true,
      points: 0,
      streak: 0,
      lastStudyDate: null
    };
    setProfile(newProfile);
    haptic('medium');
  };

  if (!profile || !profile.onboardingComplete) {
    return <LoginView onComplete={handleOnboarding} />;
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'home': return <DashboardView profile={profile} sessions={sessions} t={t} onStart={() => setActiveTab('timer')} />;
      case 'timer': return (
        <TimerView 
          profile={profile} 
          t={t} 
          isRunning={isTimerRunning} 
          seconds={timerSeconds} 
          activeSession={activeSession}
          onStart={(s) => {
            setActiveSession(s);
            setIsTimerRunning(true);
            haptic('medium');
          }}
          onToggle={() => {
            setIsTimerRunning(!isTimerRunning);
            haptic('light');
          }}
          onFinish={(session) => {
            setSessions([session, ...sessions]);
            setIsTimerRunning(false);
            setTimerSeconds(0);
            setActiveSession(null);
            localStorage.removeItem('study_streak_active_timer');
            haptic('heavy');
            
            setProfile(prev => {
              if (!prev) return prev;
              const today = new Date().toISOString().split('T')[0];
              const isNewDay = prev.lastStudyDate !== today;
              return {
                ...prev,
                points: prev.points + session.points,
                streak: isNewDay ? prev.streak + 1 : prev.streak,
                lastStudyDate: today
              };
            });
            setActiveTab('home');
          }}
          onCancel={() => {
            if (confirm("Are you sure? Progress will be lost.")) {
              setIsTimerRunning(false);
              setTimerSeconds(0);
              setActiveSession(null);
              localStorage.removeItem('study_streak_active_timer');
              haptic('medium');
            }
          }}
        />
      );
      case 'ai': return <AICoachView profile={profile} sessions={sessions} t={t} />;
      case 'stats': return <StatsView sessions={sessions} t={t} />;
      case 'settings': return <SettingsView profile={profile} setProfile={setProfile} t={t} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto relative shadow-2xl overflow-hidden selection:bg-indigo-100">
      {/* Resume Prompt Modal */}
      {resumePrompt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <Card className="w-full text-center">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <RotateCcw size={32} />
            </div>
            <h3 className="text-xl font-black mb-2">{t.resumeSession}</h3>
            <p className="text-slate-500 text-sm mb-6">You had an active session before the app closed.</p>
            <div className="flex gap-4">
              <button onClick={() => handleResumeDecision(false)} className="flex-1 py-4 font-bold text-slate-500 bg-slate-50 rounded-2xl">Discard</button>
              <button onClick={() => handleResumeDecision(true)} className="flex-1 py-4 font-bold text-white bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100">Resume</button>
            </div>
          </Card>
        </div>
      )}

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-32 safe-top">
        {renderTab()}
      </div>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/90 backdrop-blur-2xl border-t border-slate-100 px-6 py-4 flex justify-between items-center safe-bottom z-50 rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <NavButton icon={<Home size={22} />} label={lang === Language.EN ? 'Home' : 'হোম'} active={activeTab === 'home'} onClick={() => { haptic('light'); setActiveTab('home'); }} />
        <NavButton icon={<Clock size={22} />} label={t.timer} active={activeTab === 'timer'} onClick={() => { haptic('light'); setActiveTab('timer'); }} />
        <NavButton icon={<BrainCircuit size={22} />} label={lang === Language.EN ? 'AI' : 'এআই'} active={activeTab === 'ai'} onClick={() => { haptic('light'); setActiveTab('ai'); }} />
        <NavButton icon={<BarChart3 size={22} />} label={lang === Language.EN ? 'Stats' : 'গ্রাফ'} active={activeTab === 'stats'} onClick={() => { haptic('light'); setActiveTab('stats'); }} />
        <NavButton icon={<SettingsIcon size={22} />} label={lang === Language.EN ? 'More' : 'আরও'} active={activeTab === 'settings'} onClick={() => { haptic('light'); setActiveTab('settings'); }} />
      </nav>
    </div>
  );
}

// --- Sub-Views ---

const NavButton: React.FC<{ icon: React.ReactNode; label: string; active: boolean; onClick: () => void }> = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${active ? 'text-indigo-600 -translate-y-1' : 'text-slate-400'}`}>
    <div className={`${active ? 'bg-indigo-50 p-2 rounded-xl' : ''}`}>
      {icon}
    </div>
    <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

const LoginView: React.FC<{ onComplete: (name: string, nick: string, lang: Language, goal: number) => void }> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [nick, setNick] = useState('Future Engineer');
  const [lang, setLang] = useState<Language>(Language.EN);
  const [goal, setGoal] = useState(120);

  const t = LOCALIZATION[lang];

  if (step === 1) {
    return (
      <div className="min-h-screen bg-white flex flex-col p-8 justify-between max-w-md mx-auto">
        <div className="pt-20 text-center">
          <div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-indigo-200 animate-float">
            <Flame className="text-white" size={48} />
          </div>
          <h1 className="text-4xl font-black text-slate-900 mb-2">StudyStreak AI</h1>
          <p className="text-slate-500 font-medium tracking-tight">Level up your HSC preparation</p>
        </div>

        <div className="space-y-4">
          <button 
            onClick={() => { haptic('medium'); setStep(2); }}
            className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-bold text-lg flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-[0.98] shadow-xl"
          >
            {lang === Language.EN ? 'Get Started' : 'শুরু করুন'} <ChevronRight size={22} />
          </button>
          <div className="flex gap-4">
            <button onClick={() => setLang(Language.EN)} className={`flex-1 py-4 font-bold rounded-2xl border-2 ${lang === Language.EN ? 'border-indigo-600 text-indigo-600' : 'border-slate-50 text-slate-400'}`}>English</button>
            <button onClick={() => setLang(Language.BN)} className={`flex-1 py-4 font-bold rounded-2xl border-2 ${lang === Language.BN ? 'border-indigo-600 text-indigo-600' : 'border-slate-50 text-slate-400'}`}>বাংলা</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col p-8 max-w-md mx-auto pt-16">
      <div className="mb-12">
        <h2 className="text-3xl font-black text-slate-900 mb-2">Setup Profile</h2>
        <p className="text-slate-500">Let's personalize your experience</p>
      </div>

      <div className="space-y-8">
        <div>
          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">{t.enterName}</label>
          <input 
            type="text" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-5 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none text-lg font-bold"
            placeholder="e.g. Jubair Ahmed"
          />
        </div>

        <div>
          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Nickname / Goal</label>
          <input 
            type="text" 
            value={nick} 
            onChange={e => setNick(e.target.value)} 
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-5 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none text-lg font-bold"
            placeholder="e.g. Future Engineer"
          />
        </div>

        <div>
          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">{t.setGoal}</label>
          <div className="bg-slate-50 p-6 rounded-2xl">
             <div className="flex items-center justify-between mb-4">
               <span className="text-indigo-600 font-black text-2xl">{goal}</span>
               <span className="text-slate-400 font-bold text-sm">Minutes / Day</span>
             </div>
             <input 
              type="range" 
              min="30" 
              max="480" 
              step="30"
              value={goal} 
              onChange={e => setGoal(Number(e.target.value))} 
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
          </div>
        </div>

        <button 
          onClick={() => name && onComplete(name, nick, lang, goal)}
          disabled={!name}
          className="w-full bg-indigo-600 text-white py-6 rounded-[2rem] font-bold text-lg flex items-center justify-center gap-2 mt-8 shadow-xl shadow-indigo-100 disabled:opacity-50 transition-all active:scale-[0.98]"
        >
          {t.getStarted} <CheckCircle2 size={22} />
        </button>
      </div>
    </div>
  );
};

const DashboardView: React.FC<{ profile: UserProfile; sessions: StudySession[]; t: any; onStart: () => void }> = ({ profile, sessions, t, onStart }) => {
  const today = new Date().toISOString().split('T')[0];
  const todayMins = useMemo(() => {
    return sessions
      .filter(s => new Date(s.timestamp).toISOString().split('T')[0] === today)
      .reduce((acc, s) => acc + s.durationMinutes, 0);
  }, [sessions, today]);

  const progress = (todayMins / profile.dailyGoalMinutes) * 100;

  // HSC Countdown (Approximate for 2025 June)
  const examDate = new Date('2025-06-15').getTime();
  const now = new Date().getTime();
  const daysLeft = Math.max(0, Math.ceil((examDate - now) / (1000 * 60 * 60 * 24)));

  return (
    <div className="px-6 pt-6">
      <header className="mb-8 flex justify-between items-start">
        <div>
          <p className="text-slate-500 font-bold text-sm mb-1">{t.greeting(profile.name)}</p>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{profile.nickname}</h2>
        </div>
        <div className="flex gap-2">
          <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-2">
            <Flame size={18} className="text-orange-500" />
            <span className="font-black text-sm">{profile.streak}</span>
          </div>
        </div>
      </header>

      {/* Exam Countdown Card */}
      <Card className="mb-6 bg-slate-900 text-white border-none relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full -mr-16 -mt-16 blur-3xl" />
        <div className="relative z-10 flex items-center gap-5">
           <div className="bg-white/10 p-4 rounded-3xl backdrop-blur-md">
             <Calendar size={32} className="text-indigo-400" />
           </div>
           <div>
             <h4 className="text-indigo-300 text-xs font-black uppercase tracking-widest mb-1">Exam Countdown</h4>
             <div className="flex items-baseline gap-2">
               <span className="text-4xl font-black tabular-nums">{daysLeft}</span>
               <span className="text-white/60 font-bold text-sm">Days until HSC</span>
             </div>
           </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="py-8 text-center flex flex-col items-center">
          <div className="bg-yellow-50 p-4 rounded-3xl mb-4">
            <Award className="text-yellow-600" size={32} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t.points}</p>
          <p className="text-3xl font-black text-slate-900">{profile.points}</p>
        </Card>
        <Card className="py-8 text-center flex flex-col items-center">
          <div className="bg-indigo-50 p-4 rounded-3xl mb-4">
            <Zap className="text-indigo-600" size={32} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Rank</p>
          <p className="text-3xl font-black text-slate-900">Elite</p>
        </Card>
      </div>

      <Card className="mb-8 p-8 flex flex-col items-center text-center">
        <div className="w-40 h-40 relative mb-8">
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="80" cy="80" r="70" fill="transparent" stroke="#f8fafc" strokeWidth="16" />
            <circle cx="80" cy="80" r="70" fill="transparent" stroke="#4f46e5" strokeWidth="16" strokeDasharray={440} strokeDashoffset={440 - (440 * Math.min(progress, 100)) / 100} strokeLinecap="round" className="transition-all duration-1000" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
             <span className="text-4xl font-black text-slate-900 tabular-nums">{Math.round(progress)}%</span>
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.dailyGoal}</span>
          </div>
        </div>
        <div className="mb-8">
           <h3 className="text-xl font-black mb-1">{t.studyRingLabel}</h3>
           <p className="text-slate-500 font-bold">{todayMins}m / {profile.dailyGoalMinutes}m reached</p>
        </div>
        <button 
          onClick={() => { haptic('medium'); onStart(); }}
          className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black shadow-2xl shadow-indigo-100 flex items-center justify-center gap-3 hover:bg-indigo-700 active:scale-[0.98] transition-all"
        >
          <Play size={20} fill="currentColor" /> {t.startStudy}
        </button>
      </Card>
    </div>
  );
};

const TimerView: React.FC<{ 
  profile: UserProfile; 
  t: any; 
  isRunning: boolean; 
  seconds: number; 
  activeSession: any;
  onStart: (s: any) => void;
  onToggle: () => void;
  onFinish: (s: StudySession) => void;
  onCancel: () => void;
}> = ({ profile, t, isRunning, seconds, activeSession, onStart, onToggle, onFinish, onCancel }) => {
  const [selectedSub, setSelectedSub] = useState(SCIENCE_SUBJECTS[3].id); // Physics default
  const [selectedPaper, setSelectedPaper] = useState(1);
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState<TimerMode>(TimerMode.NORMAL);

  const formatTime = (s: number) => {
    const hours = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    return `${hours > 0 ? hours + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentSubject = SCIENCE_SUBJECTS.find(s => s.id === selectedSub);

  if (!isRunning && !activeSession) {
    return (
      <div className="px-6 pt-10 animate-in fade-in slide-in-from-bottom-8 duration-500">
        <h2 className="text-3xl font-black text-slate-900 mb-8">{t.startStudy}</h2>
        
        <div className="space-y-6">
          <Card>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{t.subject}</label>
            <div className="grid grid-cols-2 gap-3">
              {SCIENCE_SUBJECTS.map(s => (
                <button 
                  key={s.id}
                  onClick={() => {
                    setSelectedSub(s.id);
                    setSelectedPaper(s.papers[0]);
                    haptic('light');
                  }}
                  className={`p-4 rounded-2xl text-xs font-bold transition-all border-2 ${selectedSub === s.id ? 'bg-indigo-50 border-indigo-600 text-indigo-700' : 'bg-slate-50 border-slate-50 text-slate-500'}`}
                >
                  {profile.language === Language.EN ? s.nameEn : s.nameBn}
                </button>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{t.paper}</label>
              <div className="flex gap-2">
                {currentSubject?.papers.map(p => (
                  <button 
                    key={p}
                    onClick={() => { setSelectedPaper(p); haptic('light'); }}
                    className={`flex-1 p-4 rounded-2xl text-xs font-bold border-2 ${selectedPaper === p ? 'bg-indigo-50 border-indigo-600 text-indigo-700' : 'bg-slate-50 border-slate-50 text-slate-400'}`}
                  >
                    {p === 1 ? '1st' : '2nd'}
                  </button>
                ))}
              </div>
            </Card>

            <Card>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Mode</label>
              <select 
                value={mode}
                onChange={e => { setMode(e.target.value as TimerMode); haptic('light'); }}
                className="w-full bg-slate-50 p-4 rounded-2xl text-xs font-bold outline-none border-2 border-slate-50"
              >
                <option value={TimerMode.NORMAL}>Normal</option>
                <option value={TimerMode.POMODORO}>Pomodoro (25m)</option>
                <option value={TimerMode.DEEP_STUDY}>Deep (90m)</option>
              </select>
            </Card>
          </div>

          <Card>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{t.topic}</label>
            <input 
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Electromagnetism"
              className="w-full bg-slate-50 p-5 rounded-2xl text-base font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 border border-slate-100"
            />
          </Card>

          <button 
            onClick={() => onStart({ subjectId: selectedSub, paper: selectedPaper, topic: topic || 'General Study', mode })}
            className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black text-xl shadow-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] mb-10"
          >
            <Zap size={24} fill="currentColor" /> {t.startStudy}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-8 pt-24 flex flex-col items-center">
      <div className="w-full max-w-xs aspect-square rounded-full border-[20px] border-slate-50 flex flex-col items-center justify-center relative mb-16 shadow-[0_20px_50px_rgba(0,0,0,0.02)]">
        <div 
          className="absolute inset-[-20px] rounded-full border-[20px] border-indigo-600 transition-all duration-1000"
          style={{ 
            clipPath: `conic-gradient(from 0deg, #4f46e5 ${Math.min((seconds / 3600) * 360, 360)}deg, transparent 0deg)`,
            opacity: isRunning ? 1 : 0.3
          }}
        />
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-3">
          {profile.language === Language.EN 
            ? SCIENCE_SUBJECTS.find(s => s.id === activeSession.subjectId)?.nameEn 
            : SCIENCE_SUBJECTS.find(s => s.id === activeSession.subjectId)?.nameBn}
        </h4>
        <h2 className="text-7xl font-black text-slate-900 tabular-nums tracking-tighter">
          {formatTime(seconds)}
        </h2>
        <p className="text-sm font-black text-indigo-600 bg-indigo-50 px-4 py-1.5 rounded-full mt-6">{activeSession.topic}</p>
      </div>

      <div className="w-full space-y-5">
        <button 
          onClick={onToggle}
          className={`w-full py-6 rounded-[2.5rem] font-black text-xl transition-all shadow-xl active:scale-[0.98] ${isRunning ? 'bg-slate-100 text-slate-900' : 'bg-indigo-600 text-white shadow-indigo-100'}`}
        >
          {isRunning ? t.pause : 'Resume'}
        </button>
        
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => {
              const studyMins = Math.floor(seconds / 60);
              onFinish({
                id: Math.random().toString(36).substr(2, 9),
                subjectId: activeSession.subjectId,
                paper: activeSession.paper,
                topic: activeSession.topic,
                durationMinutes: studyMins,
                timestamp: Date.now(),
                difficulty: 'medium',
                points: studyMins * 2
              });
            }}
            className="bg-green-600 text-white py-5 rounded-[2rem] font-black shadow-xl shadow-green-100 flex items-center justify-center gap-3 active:scale-[0.98]"
          >
            <CheckCircle2 size={24} /> {t.finish}
          </button>
          <button 
            onClick={onCancel}
            className="bg-red-50 text-red-600 py-5 rounded-[2rem] font-black flex items-center justify-center gap-3 active:scale-[0.98]"
          >
            <X size={24} /> {t.cancel}
          </button>
        </div>
      </div>
    </div>
  );
};

const AICoachView: React.FC<{ profile: UserProfile; sessions: StudySession[]; t: any }> = ({ profile, sessions, t }) => {
  const [aiAdvice, setAiAdvice] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const last7Days = useMemo(() => Date.now() - 7 * 24 * 60 * 60 * 1000, []);
  const recentSessions = useMemo(() => sessions.filter(s => s.timestamp > last7Days), [sessions, last7Days]);
  
  const stats = useMemo(() => SCIENCE_SUBJECTS.map(sub => {
    const mins = recentSessions.filter(s => s.subjectId === sub.id).reduce((acc, s) => acc + s.durationMinutes, 0);
    return { ...sub, mins };
  }), [recentSessions]);

  const sorted = useMemo(() => [...stats].sort((a, b) => a.mins - b.mins), [stats]);
  const suggestion = sorted[0];

  useEffect(() => {
    const fetchAdvice = async () => {
      setLoading(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `HSC student progress: ${stats.map(s => `${s.nameEn}: ${s.mins}m`).join(', ')}. Weak: ${suggestion.nameEn}. Give 1 sentence of motivating science-themed coaching in ${profile.language === Language.EN ? 'English' : 'Bengali'}.`,
          config: { systemInstruction: "Be a strict but motivating coach for Bangladeshi science students." }
        });
        setAiAdvice(response.text || "");
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchAdvice();
  }, [profile.language, stats, suggestion.nameEn]);

  return (
    <div className="px-6 pt-10 space-y-8">
      <header>
        <h2 className="text-3xl font-black text-slate-900 mb-2">{t.aiCoach}</h2>
        <p className="text-slate-500 font-medium">Insights based on your learning data</p>
      </header>

      <Card className="bg-gradient-to-br from-indigo-600 to-indigo-950 text-white border-none shadow-2xl shadow-indigo-200 p-8">
        <div className="flex items-start gap-5 mb-6">
          <div className="bg-white/10 p-4 rounded-3xl backdrop-blur-xl">
            <BrainCircuit className="text-indigo-300" size={32} />
          </div>
          <div>
            <h4 className="font-black text-indigo-300 text-[10px] uppercase tracking-[0.2em] mb-2">Adaptive Learning Suggestion</h4>
            <p className="text-xl font-bold leading-tight">
              {t.aiSuggestion(profile.language === Language.EN ? suggestion.nameEn : suggestion.nameBn)}
            </p>
          </div>
        </div>
        <p className="text-indigo-100/60 text-sm italic font-medium">
          {loading ? "Calculating insights..." : (aiAdvice || "Keep pushing your limits. Discipline is the bridge between goals and accomplishment.")}
        </p>
      </Card>

      <div>
        <h3 className="text-xl font-black text-slate-900 mb-5 px-1">{t.weakSubject}</h3>
        <div className="space-y-4">
          {sorted.slice(0, 3).map(sub => (
            <Card key={sub.id} className="flex justify-between items-center py-5">
              <div className="flex items-center gap-5">
                <div className={`w-3 h-12 ${sub.mins < 30 ? 'bg-red-500' : 'bg-orange-400'} rounded-full`} />
                <div>
                  <h4 className="font-black text-slate-900">{profile.language === Language.EN ? sub.nameEn : sub.nameBn}</h4>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{sub.mins}m study this week</p>
                </div>
              </div>
              <div className="bg-slate-50 p-2 rounded-xl">
                 <ChevronRight className="text-slate-300" size={20} />
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xl font-black text-slate-900 mb-5 px-1">{t.revisionNeeded}</h3>
        <Card className="py-12 border-dashed border-2 border-slate-200 bg-transparent shadow-none text-center">
          <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="text-slate-300" size={32} />
          </div>
          <p className="text-slate-400 font-black px-8">Complete more sessions to unlock Spaced Repetition tracking.</p>
        </Card>
      </div>
    </div>
  );
};

const StatsView: React.FC<{ sessions: StudySession[]; t: any }> = ({ sessions, t }) => {
  const dailyData = useMemo(() => {
    const days: any = {};
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    last7.forEach(d => days[d] = 0);
    sessions.forEach(s => {
      const d = new Date(s.timestamp).toISOString().split('T')[0];
      if (days[d] !== undefined) days[d] += s.durationMinutes;
    });

    return Object.entries(days).map(([name, mins]) => ({ name: name.split('-').slice(2).join('/'), mins }));
  }, [sessions]);

  const subjectData = useMemo(() => {
    const subs: any = {};
    SCIENCE_SUBJECTS.forEach(s => subs[s.id] = 0);
    sessions.forEach(s => {
      if (subs[s.subjectId] !== undefined) subs[s.subjectId] += s.durationMinutes;
    });
    return Object.entries(subs).map(([id, mins]) => ({ 
      name: SCIENCE_SUBJECTS.find(s => s.id === id)?.nameEn.split(' ')[0], 
      mins 
    })).filter(s => (s.mins as number) > 0);
  }, [sessions]);

  return (
    <div className="px-6 pt-10 space-y-8">
      <h2 className="text-3xl font-black text-slate-900 mb-2">{t.stats}</h2>

      <Card>
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Weekly Performance</h3>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} fontWeight="bold" />
              <YAxis hide />
              <Tooltip 
                contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
              />
              <Line type="monotone" dataKey="mins" stroke="#4f46e5" strokeWidth={5} dot={{ r: 6, fill: '#4f46e5', strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Subject Distribution</h3>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={subjectData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} fontWeight="bold" />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)' }}
              />
              <Bar dataKey="mins" fill="#6366f1" radius={[12, 12, 4, 4]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div>
        <h3 className="text-xl font-black text-slate-900 mb-6 px-1">Heatmap</h3>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 28 }).map((_, i) => (
            <div key={i} className={`aspect-square rounded-lg ${i % 3 === 0 ? 'bg-indigo-600/20' : i % 5 === 0 ? 'bg-indigo-600/60' : 'bg-slate-100'}`} />
          ))}
        </div>
      </div>
    </div>
  );
};

const SettingsView: React.FC<{ profile: UserProfile; setProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>; t: any }> = ({ profile, setProfile, t }) => {
  const [editingName, setEditingName] = useState(profile.name);

  const toggleLang = () => {
    haptic('medium');
    setProfile({ ...profile, language: profile.language === Language.EN ? Language.BN : Language.EN });
  };

  const exportData = () => {
    const data = { profile, sessions: JSON.parse(localStorage.getItem('study_streak_sessions') || '[]') };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `studystreak_backup.json`;
    a.click();
    haptic('medium');
  };

  return (
    <div className="px-6 pt-10 space-y-6">
      <h2 className="text-3xl font-black text-slate-900 mb-2">{t.settings}</h2>

      <Card className="space-y-8">
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Display Name</label>
          <div className="flex gap-3">
            <input 
              type="text" 
              value={editingName} 
              onChange={e => setEditingName(e.target.value)}
              className="flex-1 bg-slate-50 p-4 rounded-2xl text-base font-bold outline-none border border-slate-100"
            />
            <button 
              onClick={() => { haptic('medium'); setProfile({ ...profile, name: editingName }); }}
              className="bg-slate-900 text-white px-6 rounded-2xl text-xs font-bold active:scale-[0.95] transition-all"
            >
              Update
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center bg-slate-50 p-6 rounded-[2rem]">
          <span className="font-black text-slate-700">App Language</span>
          <button 
            onClick={toggleLang}
            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-sm font-black shadow-lg shadow-indigo-100"
          >
            {profile.language === Language.EN ? 'English' : 'বাংলা'}
          </button>
        </div>

        <div className="flex justify-between items-center py-2 px-2">
          <span className="font-bold text-slate-700">Daily Study Goal</span>
          <span className="text-indigo-600 font-black">{profile.dailyGoalMinutes}m</span>
        </div>
      </Card>

      <Card className="bg-slate-900 text-white border-none p-8">
        <h4 className="font-black mb-6 text-slate-400 text-[10px] uppercase tracking-widest">Backup & Restore</h4>
        <div className="space-y-5">
          <button onClick={exportData} className="w-full text-left font-bold py-3 flex items-center justify-between border-b border-white/10 active:opacity-50">
            Download JSON Backup <ChevronRight size={18} />
          </button>
          <button onClick={() => alert('Feature coming in v1.1')} className="w-full text-left font-bold py-3 flex items-center justify-between opacity-40">
            Upload Backup <ChevronRight size={18} />
          </button>
        </div>
      </Card>

      <div className="text-center py-10 opacity-30">
        <p className="text-xs font-black uppercase tracking-[0.3em]">StudyStreak AI v1.0.0</p>
        <p className="text-[10px] mt-2 italic font-bold">HSC Science Exclusive Edition</p>
      </div>
    </div>
  );
}
