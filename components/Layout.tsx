
import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, Calendar, ClipboardList, History, LogOut, MessageSquare, Bell, Upload, Volume2, Users, Settings, Moon, Sun, BellRing, X, BarChart3, Menu } from 'lucide-react';
import { User, Notification, Task, CalendarEvent } from '../types';
import { MockBackend } from '../services/mockBackend';

interface LayoutProps {
    children: React.ReactNode;
    activeTab: string;
    onTabChange: (tab: string) => void;
    currentUser: User;
    onLogout: () => void;
    isDarkMode: boolean;
    toggleTheme: () => void;
    users?: User[];
}

interface TriggeredAlarm {
    id: string; // Alarm ID or Notif ID
    title: string;
    type: 'TASK' | 'EVENT' | 'TASK_ASSIGNMENT' | 'SYSTEM';
    parentId: string; // Task or Event ID or Notif ID
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, currentUser, onLogout, isDarkMode, toggleTheme }) => {
    const [activeAlarms, setActiveAlarms] = useState<TriggeredAlarm[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [audioError, setAudioError] = useState(false);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    useEffect(() => {
        const checkSystem = async () => {
            const now = new Date();
            const newTriggeredAlarms: TriggeredAlarm[] = [];

            // 1. Check Notifications (New Assignments & System Alerts like Completion Requests)
            const notifications = await MockBackend.getNotifications(currentUser.id);
            const criticalNotifs = notifications.filter(n => !n.isRead && (n.type === 'TASK_ASSIGNMENT' || n.type === 'SYSTEM'));

            for (const notif of criticalNotifs) {
                // Only trigger SYSTEM overlay for task-related critical messages (detected by regex or type context)
                if (notif.type === 'SYSTEM' && !notif.message.includes('بررسی') && !notif.message.includes('تایید')) continue;

                newTriggeredAlarms.push({
                    id: notif.id,
                    title: notif.message,
                    type: notif.type === 'TASK_ASSIGNMENT' ? 'TASK_ASSIGNMENT' : 'SYSTEM',
                    parentId: notif.id // We treat notification ID as parent for dismissal
                });
            }

            // 2. Check Tasks Alarms
            const tasks = await MockBackend.getTasks();
            for (const task of tasks) {
                if (task.alarms && task.assigneeId === currentUser.id && task.status !== 'DONE') {
                    for (const alarm of task.alarms) {
                        if (!alarm.isFired) {
                            const dueDate = new Date(task.dueDate);
                            const triggerTime = new Date(dueDate.getTime() - (alarm.offsetMinutes * 60000));
                            // Trigger if passed time
                            if (now >= triggerTime) {
                                newTriggeredAlarms.push({
                                    id: alarm.id,
                                    title: `یادآوری تسک: ${task.title}`,
                                    type: 'TASK',
                                    parentId: task.id
                                });
                            }
                        }
                    }
                }
            }

            // 3. Check Events Alarms
            const events = await MockBackend.getEvents(currentUser.id, currentUser.role);
            for (const event of events) {
                if (event.alarms && (event.ownerId === currentUser.id || event.attendees?.includes(currentUser.id))) {
                    for (const alarm of event.alarms) {
                        if (!alarm.isFired) {
                            const eventStart = new Date(event.startTime.includes('T') ? event.startTime : `${new Date().toISOString().split('T')[0]}T${event.startTime}`);
                            const triggerTime = new Date(eventStart.getTime() - (alarm.offsetMinutes * 60000));

                            if (now >= triggerTime) {
                                newTriggeredAlarms.push({
                                    id: alarm.id,
                                    title: `رویداد: ${event.title}`,
                                    type: 'EVENT',
                                    parentId: event.id
                                });
                            }
                        }
                    }
                }
            }

            if (newTriggeredAlarms.length > 0) {
                setActiveAlarms(prev => {
                    const currentIds = new Set(prev.map(a => a.id));
                    const uniqueNew = newTriggeredAlarms.filter(a => !currentIds.has(a.id));
                    return [...prev, ...uniqueNew];
                });
            }
        };

        checkSystem();
        const interval = setInterval(checkSystem, 2000); // Fast check every 2 seconds

        return () => clearInterval(interval);
    }, [currentUser.id]);

    useEffect(() => {
        if (activeAlarms.length > 0) {
            if (!audioRef.current) {
                const customSound = MockBackend.getCustomSound();
                const src = customSound || 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
                audioRef.current = new Audio(src);
                audioRef.current.loop = true;
            }
            audioRef.current.play().then(() => setAudioError(false)).catch(e => {
                console.log("Audio autoplay blocked");
                setAudioError(true);
            });
        } else {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
        }
    }, [activeAlarms.length]);

    const dismissAlarm = async (alarm: TriggeredAlarm) => {
        if (alarm.type === 'TASK_ASSIGNMENT' || alarm.type === 'SYSTEM') {
            // Mark notification as read
            await MockBackend.markNotificationRead(alarm.parentId);
        } else if (alarm.type === 'TASK') {
            const tasks = await MockBackend.getTasks();
            const task = tasks.find(t => t.id === alarm.parentId);
            if (task && task.alarms) {
                task.alarms = task.alarms.map(a => a.id === alarm.id ? { ...a, isFired: true } : a);
                await MockBackend.saveTask(task);
            }
        } else if (alarm.type === 'EVENT') {
            const events = await MockBackend.getEvents(currentUser.id, currentUser.role);
            const event = events.find(e => e.id === alarm.parentId);
            if (event && event.alarms) {
                event.alarms = event.alarms.map(a => a.id === alarm.id ? { ...a, isFired: true } : a);
                await MockBackend.saveEvent(event);
            }
        }
        setActiveAlarms(prev => prev.filter(a => a.id !== alarm.id));
    };

    const enableAudio = () => {
        if (audioRef.current) {
            audioRef.current.play();
            setAudioError(false);
        }
    };


    useEffect(() => {
        setMobileSidebarOpen(false);
    }, [activeTab]);
    const menuItems = [
        { id: 'board', label: 'دسکتاپ', icon: <LayoutDashboard size={20} /> },
        { id: 'list', label: 'تسک‌ها', icon: <ClipboardList size={20} /> },
        { id: 'calendar', label: 'تقویم', icon: <Calendar size={20} /> },
        { id: 'messages', label: 'پیام‌ها', icon: <MessageSquare size={20} /> },
        { id: 'history', label: 'سوابق', icon: <History size={20} /> },
        { id: 'analytics', label: 'تحلیل', icon: <BarChart3 size={20} /> },
    ];

    if (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN') {
        menuItems.push({ id: 'users', label: 'کاربران', icon: <Users size={20} /> });
    }

    menuItems.push({ id: 'settings', label: 'تنظیمات', icon: <Settings size={20} /> });

    return (
        <div className={`flex min-h-screen font-sans selection:bg-blue-500/30 ${isDarkMode ? 'dark text-gray-100' : 'text-gray-800'}`}>

            {/* Unified Alarm Overlay (Nagging Dialog) */}
            {activeAlarms.length > 0 && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-8 max-w-md w-full shadow-2xl border-4 border-red-100 dark:border-red-900/50 animate-bounce-subtle">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-500 mb-6 animate-pulse ring-8 ring-red-50 dark:ring-red-900/20">
                                <BellRing size={40} />
                            </div>
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">توجه فوری!</h2>
                            <p className="text-gray-500 dark:text-gray-400 mb-6">موارد زیر نیاز به پیگیری سریع دارند:</p>

                            {audioError && (
                                <button onClick={enableAudio} className="mb-4 text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full animate-pulse">
                                    برای پخش صدای هشدار کلیک کنید
                                </button>
                            )}

                            <div className="w-full space-y-3 mb-8 max-h-60 overflow-y-auto custom-scrollbar">
                                {activeAlarms.map(alarm => (
                                    <div key={alarm.id} className={`p-4 rounded-2xl flex justify-between items-center border ${alarm.type === 'TASK_ASSIGNMENT' || alarm.type === 'SYSTEM' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800'}`}>
                                        <div className="text-right">
                                      <span className={`block text-xs font-black mb-1 ${alarm.type === 'TASK_ASSIGNMENT' || alarm.type === 'SYSTEM' ? 'text-blue-600' : 'text-red-600'}`}>
                                          {alarm.type === 'TASK_ASSIGNMENT' ? 'تسک جدید!' : alarm.type === 'SYSTEM' ? 'پیام سیستم' : 'یادآوری'}
                                      </span>
                                            <span className="font-bold text-gray-800 dark:text-gray-200 text-sm">{alarm.title}</span>
                                        </div>
                                        <button
                                            onClick={() => dismissAlarm(alarm)}
                                            className="bg-white dark:bg-gray-700 text-gray-600 dark:text-white text-xs px-3 py-2 rounded-xl font-bold hover:bg-gray-100 transition-colors shadow-sm whitespace-nowrap"
                                        >
                                            متوجه شدم
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <p className="text-xs text-gray-400">تا زمانی که تایید نکنید، هشدار ادامه خواهد داشت.</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="lg:hidden fixed top-0 right-0 left-0 z-20 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-white/60 dark:border-slate-700/60 px-4 py-3 flex items-center justify-between">
                <button
                    onClick={() => setMobileSidebarOpen(true)}
                    className="p-2 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-white/70 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                    aria-label="open sidebar"
                >
                    <Menu size={20} />
                </button>
                <div className="flex items-center gap-2">
                    <img src="/taskchi-logo.svg" alt="لوگوی تسکچی" className="w-9 h-9 rounded-xl border border-white/70 dark:border-blue-300/30" />
                    <span className="font-black text-sm text-slate-800 dark:text-white">تسکچی</span>
                </div>
                <button
                    onClick={toggleTheme}
                    className="p-2 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-white/70 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                    aria-label="toggle theme"
                >
                    {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>
            </div>

            {mobileSidebarOpen && (
                <div className="lg:hidden fixed inset-0 z-20 bg-black/30" onClick={() => setMobileSidebarOpen(false)}></div>
            )}

            {/* Glass Sidebar */}
            <aside className={`w-72 bg-white/40 dark:bg-gray-900/60 backdrop-blur-2xl border-l border-white/20 dark:border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.05)] flex flex-col fixed h-full z-30 right-0 top-0 transition-all duration-300 ${mobileSidebarOpen ? "translate-x-0" : "translate-x-full"} lg:translate-x-0`}>
                <div className="p-8 flex items-center gap-4 relative">
                    <button onClick={() => setMobileSidebarOpen(false)} className="lg:hidden absolute top-4 left-4 p-2 rounded-xl bg-white/70 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200"><X size={16} /></button>
                    <img src="/taskchi-logo.svg" alt="لوگوی تسکچی" className="w-20 h-20 rounded-3xl shadow-xl shadow-blue-500/25 object-cover border-2 border-white/70 dark:border-blue-300/30" />
                    <div>
                        <h1 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">تسکچی</h1>
                        <span className="text-sm text-gray-500 dark:text-gray-400 font-medium tracking-wide">مدیریت به سبک حرفه‌ای ها</span>
                    </div>
                </div>

                <nav className="flex-1 px-4 space-y-2 py-4 overflow-y-auto">
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => onTabChange(item.id)}
                            className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 group ${
                                activeTab === item.id
                                    ? 'bg-white/80 dark:bg-white/10 shadow-lg shadow-black/5 text-blue-600 dark:text-blue-400 font-bold backdrop-blur-md'
                                    : 'text-gray-500 dark:text-gray-400 hover:bg-white/40 dark:hover:bg-white/5 hover:text-gray-800 dark:hover:text-gray-200'
                            }`}
                        >
              <span className={`transition-transform duration-300 ${activeTab === item.id ? 'scale-110' : 'group-hover:scale-110'}`}>
                {item.icon}
              </span>
                            <span>{item.label}</span>
                        </button>
                    ))}
                </nav>

                {/* Bottom Actions */}
                <div className="p-6 mt-auto space-y-4">
                    <button
                        onClick={toggleTheme}
                        className="w-full flex items-center justify-between px-4 py-3 bg-white/30 dark:bg-black/30 rounded-2xl border border-white/20 dark:border-white/10 hover:bg-white/50 dark:hover:bg-white/10 transition-colors"
                    >
             <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                {isDarkMode ? 'حالت شب' : 'حالت روز'}
             </span>
                        <div className={`p-2 rounded-full ${isDarkMode ? 'bg-yellow-400 text-yellow-900' : 'bg-gray-700 text-gray-100'}`}>
                            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                        </div>
                    </button>

                    <div className="bg-white/50 dark:bg-white/5 backdrop-blur-md p-4 rounded-3xl border border-white/50 dark:border-white/10 flex items-center gap-3 shadow-sm relative group hover:bg-white/60 dark:hover:bg-white/10 transition-colors cursor-pointer" onClick={() => onTabChange('settings')}>
                        <img src={currentUser.avatar} alt="User" className="w-10 h-10 rounded-full object-cover shadow-md" />
                        <div className="overflow-hidden flex-1">
                            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{currentUser.name}</p>
                            <p className="text-[10px] uppercase tracking-wider font-bold text-blue-600 dark:text-blue-400">
                                {currentUser.role === 'SUPER_ADMIN' ? 'سوپر ادمین' : currentUser.role === 'ADMIN' ? 'ادمین' : 'کارمند'}
                            </p>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); onLogout(); }}
                            title="خروج از حساب"
                            className="p-2 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm"
                        >
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 mr-0 lg:mr-72 pt-20 lg:pt-10 p-4 sm:p-6 lg:p-10 overflow-y-auto h-screen relative bg-transparent">
                {children}
            </main>
        </div>
    );
};

export default Layout;
