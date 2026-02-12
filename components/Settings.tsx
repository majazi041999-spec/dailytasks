import React, { useState } from 'react';
import { User } from '../types';
import { Save, Camera, User as UserIcon, Lock, Key, ShieldCheck, Sparkles } from 'lucide-react';
import { MockBackend } from '../services/mockBackend';

interface SettingsProps {
    currentUser: User;
    onUpdateUser: (updatedUser: User) => void;
}

const Settings: React.FC<SettingsProps> = ({ currentUser, onUpdateUser }) => {
    const [name, setName] = useState(currentUser.name);
    const [username, setUsername] = useState(currentUser.username);
    const [avatar, setAvatar] = useState(currentUser.avatar);
    const [password, setPassword] = useState(''); // Only change if entered
    const [loading, setLoading] = useState(false);

    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                if (evt.target?.result) {
                    setAvatar(evt.target.result as string);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const updated = {
            ...currentUser,
            name,
            username,
            avatar,
            password: password || undefined // Pass password only if changed
        };
        const result = await MockBackend.updateUser(updated);
        onUpdateUser(result);
        setLoading(false);
        alert('تنظیمات با موفقیت ذخیره شد.');
    };

    return (
        <div className="max-w-4xl mx-auto pb-10">
            <div className="flex flex-col md:flex-row gap-6 mb-8">
                {/* Visual Card */}
                <div className="flex-1 bg-gradient-to-br from-pink-500 to-rose-500 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl shadow-rose-500/20">
                     <div className="relative z-10">
                         <h2 className="text-3xl font-black mb-2">پروفایل شما</h2>
                         <p className="opacity-90 text-sm">اطلاعات شخصی خود را به‌روز نگه دارید.</p>
                         <div className="mt-8 flex items-center gap-2 bg-white/20 w-fit px-4 py-2 rounded-xl backdrop-blur-md">
                             <ShieldCheck size={20} />
                             <span className="font-bold text-sm">امنیت بالا</span>
                         </div>
                     </div>
                     <Sparkles className="absolute bottom-[-20px] left-[-20px] text-white opacity-20 w-48 h-48" />
                </div>
                
                {/* Stats Card (Placeholder) */}
                <div className="w-full md:w-1/3 bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 flex flex-col justify-center items-center text-center shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="text-5xl font-black text-gray-800 dark:text-white mb-2">۱۰۰٪</div>
                    <div className="text-gray-500 dark:text-gray-400 text-sm font-bold">تکمیل پروفایل</div>
                </div>
            </div>

            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-2xl rounded-[2.5rem] shadow-sm border border-white/60 dark:border-gray-700 p-10">
                <form onSubmit={handleSave} className="space-y-8">
                    {/* Avatar Section */}
                    <div className="flex flex-col items-center justify-center -mt-20 mb-6">
                        <div className="relative group cursor-pointer">
                            <div className="p-2 bg-white dark:bg-gray-900 rounded-full shadow-lg">
                                <img src={avatar} alt="Profile" className="w-32 h-32 rounded-full object-cover border-4 border-gray-100 dark:border-gray-700" />
                            </div>
                            <label className="absolute inset-0 flex items-center justify-center cursor-pointer">
                                <div className="bg-black/40 rounded-full w-32 h-32 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm flex items-center justify-center">
                                    <Camera className="text-white" size={32} />
                                </div>
                                <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                            </label>
                        </div>
                        <div className="mt-4 text-center">
                            <h3 className="font-black text-xl text-gray-900 dark:text-white">{currentUser.name}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">@{currentUser.username}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">نام و نام خانوادگی</label>
                            <div className="relative">
                                <UserIcon className="absolute right-4 top-4 text-gray-400" size={20} />
                                <input 
                                    type="text" 
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full pl-4 pr-12 py-3.5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-bold text-gray-800 dark:text-white"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">نام کاربری</label>
                            <div className="relative">
                                <div className="absolute right-4 top-4 text-gray-400 font-mono">@</div>
                                <input 
                                    type="text" 
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    className="w-full pl-4 pr-10 py-3.5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-bold text-gray-800 dark:text-white dir-ltr text-left"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">تغییر رمز عبور (اختیاری)</label>
                        <div className="relative">
                            <Lock className="absolute right-4 top-4 text-gray-400" size={20} />
                            <input 
                                type="password" 
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="رمز عبور جدید..."
                                className="w-full pl-4 pr-12 py-3.5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-bold text-gray-800 dark:text-white"
                            />
                        </div>
                    </div>

                    <div className="pt-4">
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-200 dark:text-gray-900 text-white font-bold py-4 rounded-2xl shadow-xl shadow-gray-900/20 dark:shadow-white/10 flex justify-center items-center gap-2 transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-70"
                        >
                            <Save size={20} />
                            {loading ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Settings;