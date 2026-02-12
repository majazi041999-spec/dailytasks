import React, { useState } from 'react';
import { BrainCircuit, Lock, User as UserIcon, ArrowRight } from 'lucide-react';

interface LoginProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gray-100">
      {/* Dynamic Background */}
      <div className="absolute top-0 left-0 w-full h-full bg-[#f3f4f6]">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/30 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/30 rounded-full blur-[120px] animate-pulse delay-700"></div>
      </div>

      <div className="relative z-10 w-full max-w-md p-8">
        <div className="bg-white/60 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-white/50 p-10">
          
          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl shadow-lg shadow-blue-500/30 flex items-center justify-center text-white mb-4 transform rotate-3">
               <BrainCircuit size={32} />
            </div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">ورود به تسکچی</h1>
            <p className="text-gray-500 text-sm mt-2">مدیریت پروژه هوشمند و یکپارچه</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
               <label className="block text-xs font-bold text-gray-500 mb-2 mr-1">نام کاربری</label>
               <div className="relative">
                 <UserIcon className="absolute right-4 top-4 text-gray-400" size={20} />
                 <input 
                    type="text" 
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full pl-4 pr-12 py-4 rounded-2xl bg-white/80 border border-white shadow-sm focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-gray-800 font-bold"
                    placeholder="نام کاربری خود را وارد کنید"
                 />
               </div>
            </div>

            <div>
               <label className="block text-xs font-bold text-gray-500 mb-2 mr-1">رمز عبور</label>
               <div className="relative">
                 <Lock className="absolute right-4 top-4 text-gray-400" size={20} />
                 <input 
                    type="password" 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-4 pr-12 py-4 rounded-2xl bg-white/80 border border-white shadow-sm focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-gray-800 font-bold"
                    placeholder="••••••••"
                 />
               </div>
            </div>

            {error && (
                <div className="text-red-500 text-xs text-center font-bold bg-red-50 py-2 rounded-xl border border-red-100">
                    {error}
                </div>
            )}

            <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-gray-900 hover:bg-black text-white font-bold py-4 rounded-2xl shadow-xl shadow-gray-900/20 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {loading ? 'در حال بررسی...' : (
                    <>
                        <span>ورود به سامانه</span>
                        <ArrowRight size={20} />
                    </>
                )}
            </button>
          </form>

          <div className="mt-8 text-center bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50">
              <p className="text-[10px] text-gray-500 font-bold mb-1">حساب‌های نمایشی (رمز عبور: 123)</p>
              <div className="flex justify-center gap-3 text-[10px] text-blue-600 font-mono">
                  <span>admin</span>
                  <span>manager</span>
                  <span>user</span>
              </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;