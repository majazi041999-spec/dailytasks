import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { Plus, Trash2, Edit2, User as UserIcon, Check, X, Shield, Users } from 'lucide-react';
import { MockBackend, generateUUID } from '../services/mockBackend';

interface UserManagementProps {
    currentUser: User;
    allUsers: User[];
    onRefreshUsers: () => void;
    onlineUserIds?: string[];
}

const UserManagement: React.FC<UserManagementProps> = ({ currentUser, allUsers, onRefreshUsers, onlineUserIds = [] }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [userForm, setUserForm] = useState({ 
        name: '', 
        username: '', 
        password: '', 
        role: 'USER' as UserRole 
    });

    const canManageAdmins = currentUser.role === 'SUPER_ADMIN';
    const isOnline = (userId: string) => onlineUserIds.includes(userId);

    const openCreateModal = () => {
        setEditingUser(null);
        setUserForm({ name: '', username: '', password: '', role: 'USER' });
        setIsModalOpen(true);
    };

    const openEditModal = (user: User) => {
        setEditingUser(user);
        setUserForm({ 
            name: user.name, 
            username: user.username, 
            password: '', 
            role: user.role 
        });
        setIsModalOpen(true);
    };

    const handleDeleteUser = async (userId: string) => {
        if (!window.confirm('آیا از حذف این کاربر اطمینان دارید؟ تمامی اطلاعات مربوطه پاک خواهد شد.')) return;
        await MockBackend.deleteUser(userId);
        onRefreshUsers();
    };

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (editingUser) {
            await MockBackend.updateUser({
                ...editingUser,
                name: userForm.name,
                username: userForm.username,
                role: userForm.role,
                password: userForm.password || undefined
            });
        } else {
            const userToSave: any = {
                id: generateUUID(),
                name: userForm.name,
                username: userForm.username,
                password: userForm.password || '123',
                role: userForm.role,
                createdBy: currentUser.id,
                avatar: `https://i.pravatar.cc/150?u=${Date.now()}`
            };
            await MockBackend.saveUser(userToSave);
        }
        
        onRefreshUsers();
        setIsModalOpen(false);
    };

    return (
        <div className="space-y-8 pb-10">
            {/* Header Hero Section */}
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden">
                <div className="relative z-10 flex justify-between items-center">
                    <div>
                        <h2 className="text-3xl font-black tracking-tight mb-2">مدیریت اعضای تیم</h2>
                        <p className="text-indigo-100 opacity-90 max-w-lg">
                            در اینجا می‌توانید کاربران جدید تعریف کنید، نقش‌ها را مدیریت کرده و دسترسی‌ها را کنترل نمایید.
                        </p>
                    </div>
                    <div className="hidden md:flex bg-white/20 backdrop-blur-md p-4 rounded-2xl items-center justify-center">
                        <Users size={40} className="text-white" />
                    </div>
                </div>
                {/* Decorative Circles */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-xl"></div>
            </div>

            <div className="flex justify-between items-center">
                <div className="flex gap-4">
                     <div className="bg-white dark:bg-gray-800 px-6 py-3 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-2">
                         <span className="text-2xl font-bold text-gray-800 dark:text-white">{allUsers.length}</span>
                         <span className="text-sm text-gray-500 dark:text-gray-400">کاربر فعال</span>
                     </div>
                </div>
                <button 
                    onClick={openCreateModal}
                    className="bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-200 dark:text-gray-900 text-white px-6 py-3 rounded-2xl shadow-lg shadow-black/20 dark:shadow-white/10 flex items-center gap-2 font-bold transition-all"
                >
                    <Plus size={20} />
                    افزودن کاربر
                </button>
            </div>

            <div className="bg-white/70 dark:bg-gray-800/60 backdrop-blur-2xl rounded-[2rem] p-8 shadow-sm border border-white/50 dark:border-gray-700 overflow-hidden">
                <table className="w-full text-right">
                    <thead>
                        <tr className="text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200/50 dark:border-gray-700/50">
                            <th className="pb-4 pr-4">کاربر</th>
                            <th className="pb-4">نام کاربری</th>
                            <th className="pb-4">نقش</th>
                            <th className="pb-4">وضعیت</th>
                            <th className="pb-4">ایجاد شده توسط</th>
                            <th className="pb-4 pl-4 text-left">عملیات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {allUsers.map(user => (
                            <tr key={user.id} className="group hover:bg-white/50 dark:hover:bg-gray-700/50 transition-colors">
                                <td className="py-4 pr-4 flex items-center gap-3">
                                    <div className="relative">
                                        <img src={user.avatar} className="w-12 h-12 rounded-2xl shadow-sm object-cover" alt="" />
                                        {user.role === 'SUPER_ADMIN' && <div className="absolute -top-1 -right-1 bg-yellow-400 text-yellow-900 p-0.5 rounded-full border-2 border-white dark:border-gray-800"><Shield size={10} fill="currentColor" /></div>}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800 dark:text-white">{user.name}</p>
                                        <p className="text-[10px] text-gray-400 dark:text-gray-500 hidden sm:block">{user.id.substring(0,8)}...</p>
                                    </div>
                                </td>
                                <td className="py-4 text-gray-600 dark:text-gray-300 font-mono text-sm">{user.username}</td>
                                <td className="py-4">
                                    <span className={`px-3 py-1 rounded-xl text-xs font-bold border ${
                                        user.role === 'SUPER_ADMIN' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' :
                                        user.role === 'ADMIN' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' :
                                        'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'
                                    }`}>
                                        {user.role === 'SUPER_ADMIN' ? 'مدیر کل' : user.role === 'ADMIN' ? 'مدیر بخش' : 'کارمند'}
                                    </span>
                                </td>
                                <td className="py-4">
                                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${isOnline(user.id) ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'}`}>
                                        <span className={`w-2 h-2 rounded-full ${isOnline(user.id) ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
                                        {isOnline(user.id) ? 'آنلاین' : 'آفلاین'}
                                    </span>
                                </td>
                                <td className="py-4 text-sm text-gray-500 dark:text-gray-400">
                                    {user.createdBy ? allUsers.find(u => u.id === user.createdBy)?.name || 'سیستم' : '-'}
                                </td>
                                <td className="py-4 pl-4 text-left">
                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {canManageAdmins && (
                                            <>
                                                <button 
                                                    onClick={() => openEditModal(user)}
                                                    className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-600 hover:text-white transition-colors"
                                                    title="ویرایش"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                {user.id !== currentUser.id && (
                                                    <button 
                                                        onClick={() => handleDeleteUser(user.id)}
                                                        className="p-2 bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-colors"
                                                        title="حذف"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* User Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 relative border border-white/20 dark:border-gray-700">
                        <button onClick={() => setIsModalOpen(false)} className="absolute top-6 left-6 text-gray-400 hover:text-red-500"><X size={20}/></button>
                        <h3 className="font-bold text-xl mb-6 text-gray-900 dark:text-white flex items-center gap-2">
                            <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-lg text-blue-600 dark:text-blue-400"><UserIcon size={20} /></div>
                            {editingUser ? 'ویرایش کاربر' : 'تعریف کاربر جدید'}
                        </h3>
                        
                        <form onSubmit={handleSaveUser} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">نام کامل</label>
                                <input 
                                    className="w-full p-3 bg-gray-50 dark:bg-gray-900 rounded-xl outline-none border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-gray-900 transition-all font-bold text-gray-800 dark:text-white"
                                    placeholder="مثال: علی رضایی"
                                    value={userForm.name}
                                    onChange={e => setUserForm({...userForm, name: e.target.value})}
                                    required
                                />
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">نام کاربری</label>
                                <input 
                                    className="w-full p-3 bg-gray-50 dark:bg-gray-900 rounded-xl outline-none border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-gray-900 transition-all text-left dir-ltr text-gray-800 dark:text-white"
                                    placeholder="Username"
                                    value={userForm.username}
                                    onChange={e => setUserForm({...userForm, username: e.target.value})}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">رمز عبور {editingUser && '(خالی بگذارید تا تغییر نکند)'}</label>
                                <input 
                                    className="w-full p-3 bg-gray-50 dark:bg-gray-900 rounded-xl outline-none border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-gray-900 transition-all text-left dir-ltr text-gray-800 dark:text-white"
                                    placeholder="Password"
                                    type="password"
                                    value={userForm.password}
                                    onChange={e => setUserForm({...userForm, password: e.target.value})}
                                    required={!editingUser}
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400">نقش کاربری</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setUserForm({...userForm, role: 'USER'})}
                                        className={`p-3 rounded-xl text-sm font-bold border transition-all ${userForm.role === 'USER' ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-600 dark:text-blue-400' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'}`}
                                    >
                                        کارمند
                                    </button>
                                    {canManageAdmins && (
                                        <button
                                            type="button"
                                            onClick={() => setUserForm({...userForm, role: 'ADMIN'})}
                                            className={`p-3 rounded-xl text-sm font-bold border transition-all ${userForm.role === 'ADMIN' ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-600 dark:text-blue-400' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'}`}
                                        >
                                            مدیر بخش
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-white font-bold py-3 rounded-xl transition-colors">انصراف</button>
                                <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors">{editingUser ? 'ذخیره تغییرات' : 'ایجاد کاربر'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;