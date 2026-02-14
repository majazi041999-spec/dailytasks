import React, { useState } from 'react';
import { Lock, User as UserIcon, ArrowRight, Moon, Sun, Sparkles, ShieldCheck } from 'lucide-react';

interface LoginProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, isDarkMode, toggleTheme }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username && password) {
      setLoading(true);
      setError('');
      const success = await onLogin(username, password);
      setLoading(false);
      if (!success) {
        setError('نام کاربری یا رمز عبور اشتباه است.');
      }
    } else {
      setError('لطفا نام کاربری و رمز عبور را وارد کنید');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-100 dark:bg-[#0b1029] p-6 transition-colors duration-300">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 -left-20 w-[32rem] h-[32rem] bg-blue-400/30 dark:bg-blue-600/20 blur-[120px] rounded-full" />
        <div className="absolute -bottom-20 -right-20 w-[30rem] h-[30rem] bg-violet-400/30 dark:bg-indigo-700/20 blur-[120px] rounded-full" />
      </div>

      <button
        onClick={toggleTheme}
        className="absolute top-6 left-6 z-20 bg-white/70 dark:bg-slate-900/70 border border-white/80 dark:border-slate-700 rounded-2xl px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 backdrop-blur-xl hover:scale-105 transition"
      >
        {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
        {isDarkMode ? 'حالت روشن' : 'حالت تاریک'}
      </button>

      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-[2.5rem] p-10 shadow-2xl shadow-blue-900/30 overflow-hidden relative">
          <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/15 rounded-full blur-2xl" />
          <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-indigo-300/20 rounded-full blur-2xl" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full text-xs font-bold mb-8">
              <Sparkles size={14} />
              نسخه حرفه‌ای مدیریت کار تیم
            </div>
            <h2 className="text-4xl font-black leading-tight mb-4">ورود به تسکچی</h2>
            <p className="text-blue-100 text-sm leading-7 mb-8">
              فضای کاری یکپارچه برای مدیریت تسک‌ها، پیام‌ها، گزارش عملکرد و هماهنگی تیمی در لحظه.
            </p>

            <div className="bg-white/10 rounded-2xl p-5 border border-white/20 login-hero-card">
              <svg viewBox="0 0 360 200" className="w-full h-40">
                <defs>
                  <linearGradient id="cardGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0.08" />
                  </linearGradient>
                </defs>
                <rect x="8" y="12" width="344" height="176" rx="18" fill="url(#cardGrad)" stroke="rgba(255,255,255,.25)" />
                <rect x="24" y="30" width="96" height="60" rx="12" fill="rgba(255,255,255,.18)" />
                <path d="M34 62L48 74L74 48" stroke="#c7f0ff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="136" y="30" width="200" height="12" rx="6" fill="rgba(255,255,255,.28)"/>
                <rect x="136" y="52" width="168" height="10" rx="5" fill="rgba(255,255,255,.18)"/>
                <rect x="136" y="70" width="184" height="10" rx="5" fill="rgba(255,255,255,.18)"/>

                <rect x="24" y="110" width="312" height="14" rx="7" fill="rgba(255,255,255,.16)"/>
                <rect x="24" y="136" width="272" height="14" rx="7" fill="rgba(255,255,255,.16)"/>
                <circle cx="316" cy="143" r="20" fill="rgba(133,219,255,.45)"/>
                <path d="M308 143L314 149L326 136" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>

          <div className="relative z-10 bg-white/10 rounded-2xl p-5 border border-white/20 mt-6">
            <p className="text-xs text-blue-100 mb-2">حساب‌های نمایشی</p>
            <div className="flex gap-2 text-xs font-mono">
              <span className="bg-white/20 rounded-lg px-2 py-1">admin</span>
              <span className="bg-white/20 rounded-lg px-2 py-1">manager</span>
              <span className="bg-white/20 rounded-lg px-2 py-1">user</span>
            </div>
          </div>
        </div>

        

        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_24px_60px_rgba(15,23,42,0.18)] border border-white/80 dark:border-slate-700/70 p-8 md:p-10">
          <div className="flex flex-col items-center mb-8">
            <img src="/taskchi-logo.svg" alt="لوگوی تسکچی" className="w-32 h-32 rounded-[2rem] shadow-xl shadow-blue-500/25 object-cover mb-4 border-2 border-white/80 dark:border-blue-300/30" />
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">ورود به پنل مدیریت</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">با حساب کاربری خود وارد شوید</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 mr-1">نام کاربری</label>
              <div className="login-input-wrap">
                <UserIcon className="login-input-icon absolute right-4 top-4 text-slate-400" size={20} />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full pl-4 pr-12 py-4 rounded-2xl bg-white/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-blue-400/20 outline-none transition-all text-slate-800 dark:text-white font-bold"
                  placeholder="نام کاربری خود را وارد کنید"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 mr-1">رمز عبور</label>
              <div className="login-input-wrap">
                <Lock className="login-input-icon absolute right-4 top-4 text-slate-400" size={20} />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-4 pr-12 py-4 rounded-2xl bg-white/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-blue-400/20 outline-none transition-all text-slate-800 dark:text-white font-bold"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="text-rose-500 text-xs text-center font-bold bg-rose-50 dark:bg-rose-900/20 py-2 rounded-xl border border-rose-100 dark:border-rose-800/40">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="login-submit-btn w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-900/20 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? 'در حال بررسی...' : (
                <>
                  <span>ورود به سامانه</span>
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <ShieldCheck size={14} className="text-emerald-500" />
            ارتباط امن و محافظت‌شده
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
