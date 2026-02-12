
import React, { useState, useEffect, useRef } from 'react';
import Layout from './components/Layout';
import Login from './components/Login';
import { MockBackend, getRealtimeSocketUrl } from './services/mockBackend';
import { Task, User, TaskStatus, ActionLog, Priority, Notification } from './types';
import TaskCard from './components/TaskCard';
import TaskModal from './components/TaskModal';
import JalaliCalendar from './components/JalaliCalendar';
import ChatSystem from './components/ChatSystem';
import UserManagement from './components/UserManagement';
import Settings from './components/Settings';
import { DailyQuote } from './components/DailyQuote';
import AIAssistant from './components/AIAssistant';
import { Plus, Search, Filter, X, User as UserIcon, WifiOff, Bell, Volume2, Activity, Trash2, ChevronDown, ChevronUp, Sparkles, Volume1 } from 'lucide-react';
import JalaliDatePicker from './components/JalaliDatePicker';
import PaginationControl from './components/PaginationControl';

// Reliable public sound URL
const NOTIFICATION_SOUND_URL = 'https://codeskulptor-demos.commondatastorage.googleapis.com/pang/pop.mp3';

// Pagination Constants
const BOARD_ITEMS_PER_PAGE = 5;
const LIST_ITEMS_PER_PAGE = 8;

const App: React.FC = () => {
    // --- AUTH STATE (OPTIMISTIC & CACHED) ---
    const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('modiriat_token_v3'));
    const [currentUser, setCurrentUser] = useState<User | null>(() => MockBackend.getCachedUser());

    // Loading State
    const [isAuthLoading, setIsAuthLoading] = useState(false);

    // --- APP DATA STATE ---
    const [activeTab, setActiveTab] = useState('board');
    const [tasks, setTasks] = useState<Task[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [logs, setLogs] = useState<ActionLog[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadNotifCount, setUnreadNotifCount] = useState(0);
    const [showNotifPanel, setShowNotifPanel] = useState(false);

    // History Expansion State
    const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});

    // Data loading logic
    const [isDataLoading, setIsDataLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(true); // Initial load
    const [connectionError, setConnectionError] = useState(false);

    // --- THEME ---
    const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

    // --- AI & MODALS ---
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);

    // --- FILTERS ---
    const [searchQuery, setSearchQuery] = useState('');
    const [filterAssignee, setFilterAssignee] = useState<string>('ALL');
    const [filterStartDate, setFilterStartDate] = useState<string>('');
    const [filterEndDate, setFilterEndDate] = useState<string>('');
    const [filterPriority, setFilterPriority] = useState<string>('ALL');
    const [showFilters, setShowFilters] = useState(false);

    // --- PAGINATION STATE ---
    const [boardPages, setBoardPages] = useState<Record<string, number>>({
        [TaskStatus.TODO]: 1,
        [TaskStatus.IN_PROGRESS]: 1,
        [TaskStatus.IN_REVIEW]: 1,
        [TaskStatus.DONE]: 1
    });
    const [listPage, setListPage] = useState(1);

    // --- NOTIFICATION & SOUND ---
    const lastNotifIdRef = useRef<string | null>(null);
    const isFirstLoadRef = useRef(true);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const appSocketRef = useRef<WebSocket | null>(null);
    const reconnectAppSocketRef = useRef<number | null>(null);

    const [toastData, setToastData] = useState<Notification | null>(null);
    const [isToastVisible, setIsToastVisible] = useState(false);
    const [volume, setVolume] = useState(() => parseFloat(localStorage.getItem('app_volume') || '0.8'));

    // Setup Audio & Interaction Unlocker
    useEffect(() => {
        audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
        audioRef.current.volume = volume;

        const unlockAudio = () => {
            if (audioRef.current) {
                audioRef.current.play().then(() => {
                    audioRef.current?.pause();
                    audioRef.current!.currentTime = 0;
                }).catch(() => {});
            }
            document.removeEventListener('click', unlockAudio);
            document.removeEventListener('keydown', unlockAudio);
        };

        document.addEventListener('click', unlockAudio);
        document.addEventListener('keydown', unlockAudio);
        return () => {
            document.removeEventListener('click', unlockAudio);
            document.removeEventListener('keydown', unlockAudio);
        };
    }, []);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume;
        }
    }, [volume]);

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = parseFloat(e.target.value);
        setVolume(v);
        localStorage.setItem('app_volume', v.toString());
        if (audioRef.current && !isToastVisible) {
            audioRef.current.volume = v;
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => {});
        }
    };

    // Theme Effect
    useEffect(() => {
        if (isDarkMode) {
            document.body.classList.add('dark');
            document.body.classList.replace('bg-pattern-light', 'bg-pattern-dark');
        } else {
            document.body.classList.remove('dark');
            document.body.classList.replace('bg-pattern-dark', 'bg-pattern-light');
        }
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    }, [isDarkMode]);

    // Reset Pagination when Filters Change
    useEffect(() => {
        setListPage(1);
        setBoardPages({
            [TaskStatus.TODO]: 1,
            [TaskStatus.IN_PROGRESS]: 1,
            [TaskStatus.IN_REVIEW]: 1,
            [TaskStatus.DONE]: 1
        });
    }, [searchQuery, filterAssignee, filterPriority, filterStartDate, filterEndDate]);

    // Reset Filters UI when tab changes
    useEffect(() => {
        setShowFilters(false);
    }, [activeTab]);

    // --- BACKGROUND SESSION CHECK ---
    useEffect(() => {
        const token = localStorage.getItem('modiriat_token_v3');
        if (!token) {
            if (isAuthenticated) handleLogout();
            setIsLoading(false);
            return;
        }

        const validateBackground = async () => {
            try {
                const user = await MockBackend.validateSession();
                if (user) {
                    setCurrentUser(user);
                    setIsAuthenticated(true);
                    setConnectionError(false);
                } else {
                    console.warn("Session invalid (401). Logging out.");
                    handleLogout();
                }
            } catch (e: any) {
                console.log("Background validation failed:", e.message);
                setConnectionError(true);
            } finally {
                if (!MockBackend.getCachedUser()) setIsLoading(false);
            }
        };

        validateBackground();
    }, []);

    // Initial Data Load
    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            setConnectionError(false);
            try {
                const fetchedUsers = await MockBackend.getAllUsers();
                setUsers(fetchedUsers);
                if (currentUser) {
                    await loadUserData(currentUser.id);
                }
            } catch (error) {
                console.error("Failed to fetch initial data:", error);
                setConnectionError(true);
            } finally {
                setIsLoading(false);
            }
        }
        init();
    }, [currentUser?.id]);

    // --- REAL-TIME SYNC LOOP (WEBSOCKET + ON-DEMAND FETCH) ---
    useEffect(() => {
        if (!currentUser) return;

        const syncNotifications = async () => {
            const notifs = await MockBackend.getNotifications(currentUser.id);
            const sortedNotifs = notifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            if (sortedNotifs.length > 0) {
                const newest = sortedNotifs[0];
                if (newest.id !== lastNotifIdRef.current) {
                    if (!isFirstLoadRef.current && !newest.isRead) {
                        triggerNotification(newest);
                    }
                    lastNotifIdRef.current = newest.id;
                }
            }
            isFirstLoadRef.current = false;
            setNotifications(sortedNotifs);
            setUnreadNotifCount(sortedNotifs.filter(n => !n.isRead).length);
        };

        const initialSync = async () => {
            try {
                await syncNotifications();
                setTasks(await MockBackend.getTasks());
                setUsers(await MockBackend.getAllUsers());
                if (activeTab === 'history') {
                    setLogs(await MockBackend.getLogs());
                }
            } catch (e) {
                // Silent fail
            }
        };

        const connectAppSocket = () => {
            try {
                const ws = new WebSocket(getRealtimeSocketUrl());
                appSocketRef.current = ws;

                ws.onmessage = async (event) => {
                    try {
                        const { event: eventName, payload } = JSON.parse(event.data);

                        if (eventName === 'notification:new' || eventName === 'notification:updated') {
                            const notificationUserId = payload?.userId;
                            if (!notificationUserId || notificationUserId === currentUser.id) {
                                await syncNotifications();
                            }
                        }

                        if (eventName === 'users:changed') {
                            setUsers(await MockBackend.getAllUsers());
                        }

                        if (eventName === 'tasks:changed') {
                            setTasks(await MockBackend.getTasks());
                        }

                        if (eventName === 'logs:changed' && activeTab === 'history') {
                            setLogs(await MockBackend.getLogs());
                        }
                    } catch (err) {
                        console.error('App socket event parse error:', err);
                    }
                };

                ws.onclose = () => {
                    if (reconnectAppSocketRef.current) window.clearTimeout(reconnectAppSocketRef.current);
                    reconnectAppSocketRef.current = window.setTimeout(connectAppSocket, 1500);
                };
            } catch (e) {
                if (reconnectAppSocketRef.current) window.clearTimeout(reconnectAppSocketRef.current);
                reconnectAppSocketRef.current = window.setTimeout(connectAppSocket, 1500);
            }
        };

        initialSync();
        connectAppSocket();

        return () => {
            if (reconnectAppSocketRef.current) window.clearTimeout(reconnectAppSocketRef.current);
            reconnectAppSocketRef.current = null;
            if (appSocketRef.current) {
                appSocketRef.current.onclose = null;
                appSocketRef.current.close();
                appSocketRef.current = null;
            }
        };
    }, [currentUser, activeTab]);

    const safePlaySound = () => {
        if (audioRef.current) {
            const customSound = MockBackend.getCustomSound();
            if (customSound) {
                const tempAudio = new Audio(customSound);
                tempAudio.volume = volume;
                tempAudio.play().catch(e => console.warn("Custom sound blocked:", e));
            } else {
                audioRef.current.currentTime = 0;
                audioRef.current.volume = volume;
                audioRef.current.play().catch(e => console.warn("Standard sound blocked:", e));
            }
        }
    };

    const triggerNotification = (notif: Notification) => {
        safePlaySound();
        setToastData(notif);
        setIsToastVisible(true);
        setTimeout(() => setIsToastVisible(false), 6000);
    };

    const toggleTheme = () => setIsDarkMode(!isDarkMode);

    const handleLogin = async (username: string, password: string): Promise<boolean> => {
        const user = await MockBackend.authenticate(username, password);
        if (user) {
            setCurrentUser(user);
            setIsAuthenticated(true);
            isFirstLoadRef.current = true;
            lastNotifIdRef.current = null;
            MockBackend.logAction('', 'LOGIN', 'ورود به سیستم');
            return true;
        }
        return false;
    };

    const handleLogout = () => {
        MockBackend.endSession();
        setCurrentUser(null);
        setIsAuthenticated(false);
        setTasks([]);
        setActiveTab('board');
        lastNotifIdRef.current = null;
        isFirstLoadRef.current = true;
    };

    const loadUserData = async (userId: string) => {
        try {
            const [fetchedTasks, fetchedLogs] = await Promise.all([
                MockBackend.getTasks(),
                MockBackend.getLogs()
            ]);
            setTasks(fetchedTasks);
            setLogs(fetchedLogs);
        } catch (error) {
            console.error("Error loading user data", error);
        }
    };

    const refreshUsers = async () => {
        const updatedUsers = await MockBackend.getAllUsers();
        setUsers(updatedUsers);
    };

    const handleUpdateProfile = (updatedUser: User) => {
        setCurrentUser(updatedUser);
        refreshUsers();
    };

    const handleSaveTask = async (task: Task) => {
        const saved = await MockBackend.saveTask(task);
        setTasks(prev => {
            const exists = prev.find(t => t.id === saved.id);
            if (exists) return prev.map(t => t.id === saved.id ? saved : t);
            return [...prev, saved];
        });
        const l = await MockBackend.getLogs();
        setLogs(l);
    };

    const handleDeleteTask = async (id: string) => {
        if(!window.confirm('آیا از حذف این تسک اطمینان دارید؟')) return;
        await MockBackend.deleteTask(id);
        setTasks(prev => prev.filter(t => t.id !== id));
        setLogs(await MockBackend.getLogs());
    };

    const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                if (evt.target?.result) {
                    MockBackend.saveCustomSound(evt.target.result as string);
                    alert('صدای نوتیفیکیشن با موفقیت آپلود شد.');
                    safePlaySound();
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const toggleLogDate = (date: string) => {
        setExpandedLogs(prev => ({
            ...prev,
            [date]: !prev[date]
        }));
    };

    // --- Filtering & Security Logic ---
    const accessibleTasks = tasks.filter(t => {
        if (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN') return true;
        return t.assigneeId === currentUser.id || t.assignedById === currentUser.id;
    });

    const filteredTasks = accessibleTasks.filter(t => {
        const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesAssignee = filterAssignee === 'ALL' || t.assigneeId === filterAssignee;
        const matchesPriority = filterPriority === 'ALL' || t.priority === filterPriority;
        let matchesDate = true;
        if (filterStartDate || filterEndDate) {
            const taskDate = new Date(t.dueDate).getTime();
            const taskD = new Date(taskDate); taskD.setHours(0,0,0,0);

            if (filterStartDate) {
                const startD = new Date(filterStartDate); startD.setHours(0,0,0,0);
                matchesDate = matchesDate && taskD.getTime() >= startD.getTime();
            }
            if (filterEndDate) {
                const endD = new Date(filterEndDate); endD.setHours(0,0,0,0);
                matchesDate = matchesDate && taskD.getTime() <= endD.getTime();
            }
        }
        return matchesSearch && matchesAssignee && matchesPriority && matchesDate;
    });

    const clearFilters = () => {
        setSearchQuery('');
        setFilterAssignee('ALL');
        setFilterPriority('ALL');
        setFilterStartDate('');
        setFilterEndDate('');
    };

    const activeFiltersCount = (filterAssignee !== 'ALL' ? 1 : 0) + (filterPriority !== 'ALL' ? 1 : 0) + (filterStartDate ? 1 : 0) + (filterEndDate ? 1 : 0);

    // Helper to determine if we should show search/filters
    const showTaskControls = activeTab === 'board' || activeTab === 'list';

    const groupedLogs = logs.reduce((acc, log) => {
        const date = new Date(log.timestamp).toLocaleDateString('fa-IR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        if (!acc[date]) acc[date] = [];
        acc[date].push(log);
        return acc;
    }, {} as Record<string, ActionLog[]>);

    if (isLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#f3f4f6] dark:bg-[#0f172a] gap-4">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                <p className="text-gray-500 font-medium text-sm animate-pulse">در حال اتصال به سرور (ممکن است تا ۱ دقیقه طول بکشد)...</p>
            </div>
        );
    }

    if (connectionError && !currentUser) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#f3f4f6] dark:bg-[#0f172a] gap-6 text-center px-4">
                <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-full text-red-500">
                    <WifiOff size={48} />
                </div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">خطا در برقراری ارتباط با سرور</h2>
                <p className="text-gray-500 text-sm max-w-md">لطفا مطمئن شوید سرویس Backend در حال اجراست و سپس مجددا تلاش کنید.</p>
                <button onClick={() => window.location.reload()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-2xl shadow-lg shadow-blue-500/30 transition-all">تلاش مجدد</button>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Login onLogin={handleLogin} />;
    }

    if (!currentUser) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#f3f4f6] dark:bg-[#0f172a] relative overflow-hidden">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                <p className="text-gray-500 font-medium">در حال بازیابی اطلاعات...</p>
            </div>
        );
    }

    return (
        <Layout
            activeTab={activeTab}
            onTabChange={setActiveTab}
            currentUser={currentUser}
            users={users}
            onLogout={handleLogout}
            isDarkMode={isDarkMode}
            toggleTheme={toggleTheme}
        >
            <audio ref={audioRef} className="hidden" />

            {/* Connection Error Toast */}
            {connectionError && (
                <div className="fixed bottom-4 left-4 z-[9999] bg-red-500 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom">
                    <WifiOff size={20} className="animate-pulse"/>
                    <span className="text-sm font-bold">اتصال به سرور برقرار نیست. تغییرات ذخیره نمی‌شوند.</span>
                </div>
            )}

            {/* --- TOAST NOTIFICATION POPUP --- */}
            <div className="fixed top-10 left-10 z-[9999] pointer-events-none">
                <div
                    className={`transform transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) ${isToastVisible ? 'translate-y-0 opacity-100 scale-100 pointer-events-auto' : '-translate-y-20 opacity-0 scale-90'}`}
                >
                    {toastData && (
                        <div
                            className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-2xl border-2 border-blue-500/20 dark:border-blue-400/20 p-4 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] flex items-center gap-4 max-w-sm cursor-pointer hover:scale-105 transition-transform"
                            onClick={() => { setShowNotifPanel(true); setIsToastVisible(false); }}
                        >
                            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3.5 rounded-full text-white shadow-lg shadow-blue-500/30 relative shrink-0">
                                <Bell size={22} />
                                <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-gray-800 animate-ping"></span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-black text-gray-900 dark:text-white mb-0.5 text-sm">پیام جدید</h4>
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 leading-snug truncate">{toastData.message}</p>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsToastVisible(false); }}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 bg-gray-100 dark:bg-gray-700 rounded-full transition-colors"
                            >
                                <X size={14}/>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Header */}
            {activeTab !== 'messages' && activeTab !== 'settings' && (
                <header className="flex flex-col gap-6 mb-8 animate-in fade-in slide-in-from-top-4 duration-700 relative z-20">
                    <div className="flex justify-between items-end">
                        <div>
                            <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-1 tracking-tight">سلام، {currentUser.name.split(' ')[0]}</h1>
                            <div className="flex items-center gap-2">
                                <p className="text-gray-500 dark:text-gray-400 font-medium">به سیب‌تسک خوش آمدید 👋</p>
                                {isDataLoading && <span className="text-xs text-blue-500 animate-pulse">(در حال بروزرسانی...)</span>}
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Notification Bell */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowNotifPanel(!showNotifPanel)}
                                    className="w-12 h-12 bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 transition-all shadow-sm border border-white/60 dark:border-gray-700"
                                >
                                    <Bell size={20} className={unreadNotifCount > 0 ? "animate-pulse" : ""} />
                                    {unreadNotifCount > 0 && (
                                        <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-white dark:border-gray-900 flex items-center justify-center text-[8px] text-white font-bold">{unreadNotifCount}</span>
                                    )}
                                </button>

                                {/* Notification Dropdown */}
                                {showNotifPanel && (
                                    <div className="absolute left-0 mt-3 w-80 bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/50 dark:border-white/10 p-4 animate-in fade-in slide-in-from-top-4 z-50">
                                        <div className="flex justify-between items-center mb-4 px-2">
                                            <h3 className="font-bold text-gray-800 dark:text-white">اعلان‌ها</h3>
                                            <label className="cursor-pointer text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-2 py-1 rounded-lg transition-colors">
                                                <Volume2 size={14} />
                                                تغییر زنگ
                                                <input type="file" accept="audio/*" className="hidden" onChange={handleAudioUpload} />
                                            </label>
                                        </div>

                                        {/* Volume Control */}
                                        <div className="px-2 mb-4 flex items-center gap-2">
                                            <Volume1 size={14} className="text-gray-400" />
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.1"
                                                value={volume}
                                                onChange={handleVolumeChange}
                                                className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                            />
                                            <span className="text-[10px] w-6 text-gray-500 font-mono">{Math.round(volume * 100)}%</span>
                                        </div>

                                        <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar">
                                            {notifications.length === 0 ? <p className="text-gray-400 text-center text-sm py-4">اعلانی وجود ندارد</p> :
                                                notifications.map(n => (
                                                    <div key={n.id} onClick={() => MockBackend.markNotificationRead(n.id)} className={`p-3 rounded-2xl text-sm transition-colors cursor-pointer ${n.isRead ? 'bg-gray-50 dark:bg-gray-800 text-gray-400' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 border border-blue-100 dark:border-blue-800 shadow-sm'}`}>
                                                        {n.message}
                                                        <div className="text-[10px] mt-1 opacity-50 text-right">{new Date(n.timestamp).toLocaleTimeString('fa-IR')}</div>
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    </div>
                                )}
                            </div>

                            {showTaskControls && (
                                <button
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all border ${showFilters || activeFiltersCount > 0 ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400' : 'bg-white/70 dark:bg-gray-800/70 border-white/60 dark:border-gray-700 text-gray-500 hover:bg-white dark:hover:bg-gray-700'}`}
                                >
                                    <div className="relative">
                                        <Filter size={20} />
                                        {activeFiltersCount > 0 && (
                                            <span className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">{activeFiltersCount}</span>
                                        )}
                                    </div>
                                </button>
                            )}

                            {showTaskControls && (
                                <div className="relative group hidden sm:block">
                                    <Search className="absolute right-4 top-3.5 text-gray-400 dark:text-gray-500 group-focus-within:text-blue-500 transition-colors" size={20} />
                                    <input
                                        type="text"
                                        placeholder="جستجو..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-4 pr-12 py-3.5 rounded-2xl bg-white/70 dark:bg-gray-800/70 border border-white/60 dark:border-gray-700 shadow-sm focus:bg-white dark:focus:bg-gray-800 focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-blue-500/20 outline-none w-64 transition-all text-gray-800 dark:text-white placeholder-gray-400"
                                    />
                                </div>
                            )}

                            {(currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN') && (
                                <button
                                    onClick={() => { setEditingTask(null); setIsModalOpen(true); }}
                                    className="bg-gray-900 dark:bg-white hover:bg-black dark:hover:bg-gray-200 text-white dark:text-gray-900 px-6 py-3.5 rounded-2xl shadow-xl shadow-black/20 dark:shadow-white/5 flex items-center gap-2 font-bold transition-all transform hover:scale-105 active:scale-95"
                                >
                                    <Plus size={20} />
                                    تسک جدید
                                </button>
                            )}
                        </div>
                    </div>

                    {showFilters && showTaskControls && (
                        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/60 dark:border-gray-700 p-4 rounded-3xl shadow-sm animate-in slide-in-from-top-2 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            {/* ... (Existing Filter Logic) ... */}
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 mr-2">مسئول انجام</label>
                                <div className="relative">
                                    <UserIcon size={16} className="absolute right-3 top-3.5 text-gray-400" />
                                    <select
                                        value={filterAssignee}
                                        onChange={e => setFilterAssignee(e.target.value)}
                                        className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-xl py-3 pr-9 pl-3 text-sm font-bold outline-none focus:border-blue-500 appearance-none"
                                    >
                                        <option value="ALL">همه کاربران</option>
                                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 mr-2">اولویت</label>
                                <select
                                    value={filterPriority}
                                    onChange={e => setFilterPriority(e.target.value)}
                                    className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-xl py-3 px-3 text-sm font-bold outline-none focus:border-blue-500"
                                >
                                    <option value="ALL">همه اولویت‌ها</option>
                                    <option value={Priority.LOW}>پایین</option>
                                    <option value={Priority.MEDIUM}>متوسط</option>
                                    <option value={Priority.HIGH}>بالا</option>
                                    <option value={Priority.CRITICAL}>بحرانی</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 mr-2">بازه زمانی (سررسید)</label>
                                <div className="flex gap-2">
                                    <div className="flex-1 min-w-0">
                                        <JalaliDatePicker
                                            value={filterStartDate}
                                            onChange={setFilterStartDate}
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <JalaliDatePicker
                                            value={filterEndDate}
                                            onChange={setFilterEndDate}
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={clearFilters}
                                className="bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 py-3 px-4 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 h-[46px]"
                            >
                                <X size={16} />
                                حذف فیلترها
                            </button>
                        </div>
                    )}
                </header>
            )}

            {/* Daily Quote Section */}
            {activeTab !== 'messages' && activeTab !== 'history' && <DailyQuote />}

            {/* Content with Transition */}
            <div key={activeTab} className="animate-fade-scale">

                {/* NEW AI Assistant Component */}
                {activeTab === 'board' && (
                    <AIAssistant
                        tasks={tasks}
                        users={users}
                        currentUser={currentUser}
                    />
                )}

                {/* Views */}
                {activeTab === 'board' && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-20">
                        {(Object.values(TaskStatus) as TaskStatus[]).map(status => {
                            const statusTasks = filteredTasks.filter(t => t.status === status);
                            const labels: Record<string, string> = {
                                [TaskStatus.TODO]: 'برای انجام',
                                [TaskStatus.IN_PROGRESS]: 'در حال انجام',
                                [TaskStatus.IN_REVIEW]: 'در انتظار بررسی',
                                [TaskStatus.DONE]: 'تکمیل شده'
                            };

                            // Pagination Logic for Column
                            const currentPage = boardPages[status] || 1;
                            const totalPages = Math.ceil(statusTasks.length / BOARD_ITEMS_PER_PAGE);
                            const paginatedTasks = statusTasks.slice(
                                (currentPage - 1) * BOARD_ITEMS_PER_PAGE,
                                currentPage * BOARD_ITEMS_PER_PAGE
                            );

                            return (
                                <div key={status} className="flex flex-col h-full">
                                    <div className="flex justify-between items-center mb-6 px-2">
                                        <h3 className="font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-xs">{labels[status]}</h3>
                                        <span className="bg-white/50 dark:bg-gray-800/50 px-3 py-1 rounded-full text-xs font-bold text-gray-600 dark:text-gray-300 shadow-sm">{statusTasks.length}</span>
                                    </div>
                                    <div className="space-y-4 flex-1">
                                        {paginatedTasks.map(task => (
                                            <TaskCard
                                                key={task.id}
                                                task={task}
                                                allUsers={users}
                                                onClick={(t) => { setEditingTask(t); setIsModalOpen(true); }}
                                            />
                                        ))}
                                        {statusTasks.length === 0 && (
                                            <div className="text-center py-10 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl opacity-50">
                                                <p className="text-sm text-gray-400 dark:text-gray-600 font-bold">خالی</p>
                                            </div>
                                        )}
                                    </div>
                                    {/* Pagination Control for Column */}
                                    <div className="mt-auto">
                                        <PaginationControl
                                            currentPage={currentPage}
                                            totalPages={totalPages}
                                            onPageChange={(page) => setBoardPages(prev => ({...prev, [status]: page}))}
                                            variant="compact"
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Other Tabs... */}
                {activeTab === 'calendar' && (
                    <JalaliCalendar currentUser={currentUser} users={users} />
                )}

                {activeTab === 'messages' && (
                    <ChatSystem currentUser={currentUser} users={users} />
                )}

                {activeTab === 'list' && (() => {
                    // List View Pagination Logic
                    const totalPages = Math.ceil(filteredTasks.length / LIST_ITEMS_PER_PAGE);
                    const paginatedListTasks = filteredTasks.slice(
                        (listPage - 1) * LIST_ITEMS_PER_PAGE,
                        listPage * LIST_ITEMS_PER_PAGE
                    );

                    return (
                        <div className="bg-white/70 dark:bg-gray-800/60 backdrop-blur-2xl rounded-[2rem] p-8 shadow-sm border border-white/50 dark:border-gray-700">
                            <table className="w-full border-collapse">
                                <thead>
                                <tr className="text-right text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200/50 dark:border-gray-700/50">
                                    <th className="pb-6 pr-4 font-bold">عنوان وظیفه</th>
                                    <th className="pb-6 font-bold">وضعیت</th>
                                    <th className="pb-6 font-bold">اولویت</th>
                                    <th className="pb-6 pl-4 font-bold">مسئول</th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100/50 dark:divide-gray-700/50">
                                {paginatedListTasks.map(task => (
                                    <tr key={task.id} onClick={() => { setEditingTask(task); setIsModalOpen(true); }} className="group hover:bg-white/60 dark:hover:bg-gray-700/60 cursor-pointer transition-colors">
                                        <td className="py-5 pr-4 font-bold text-gray-800 dark:text-gray-200">{task.title}</td>
                                        <td className="py-5"><span className="text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-lg">{task.status}</span></td>
                                        <td className="py-5"><span className="text-sm font-bold text-blue-600 dark:text-blue-400">{task.priority}</span></td>
                                        <td className="py-5 pl-4">
                                            <img src={users.find(u => u.id === task.assigneeId)?.avatar} className="w-8 h-8 rounded-full shadow-sm" alt="" />
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>

                            <PaginationControl
                                currentPage={listPage}
                                totalPages={totalPages}
                                onPageChange={setListPage}
                            />
                        </div>
                    );
                })()}

                {activeTab === 'users' && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN') && (
                    <UserManagement currentUser={currentUser} allUsers={users} onRefreshUsers={refreshUsers} />
                )}

                {activeTab === 'settings' && (
                    <Settings currentUser={currentUser} onUpdateUser={handleUpdateProfile} />
                )}

                {activeTab === 'history' && (
                    <div className="max-w-4xl mx-auto pb-10">
                        {/* Visual Header */}
                        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-[2.5rem] p-8 mb-8 text-white shadow-xl shadow-teal-500/20 relative overflow-hidden">
                            <div className="relative z-10">
                                <h2 className="text-3xl font-black mb-2">تایم‌لاین فعالیت‌ها</h2>
                                <p className="opacity-90">گزارش کامل عملکرد تیم به صورت لحظه‌ای.</p>
                            </div>
                            <Activity size={120} className="absolute -bottom-6 -left-6 opacity-20 rotate-12" />
                        </div>

                        <div className="relative space-y-6">
                            {Object.entries(groupedLogs).map(([date, rawDayLogs]) => {
                                const dayLogs = rawDayLogs as ActionLog[];
                                const isExpanded = expandedLogs[date] ?? true; // Default to open or handle initial state logic

                                return (
                                    <div key={date} className="relative">
                                        {/* Date Header Group */}
                                        <div
                                            className="relative group cursor-pointer overflow-hidden rounded-2xl mb-4 shadow-sm border border-gray-100 dark:border-gray-700 transition-all hover:shadow-md"
                                            onClick={() => toggleLogDate(date)}
                                        >
                                            <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-r from-blue-500/5 to-purple-500/5 dark:from-blue-500/10 dark:to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                                            <div className="bg-white dark:bg-gray-800 p-4 flex justify-between items-center relative z-10">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-2 h-8 bg-blue-500 rounded-full"></div>
                                                    <h3 className="text-lg font-black text-gray-800 dark:text-white">{date}</h3>
                                                    <span className="bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-3 py-1 rounded-lg text-xs font-bold">{dayLogs.length} فعالیت</span>
                                                </div>
                                                <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                                    <ChevronDown className="text-gray-400" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Logs List - Collapsible */}
                                        <div className={`space-y-3 pr-4 border-r-2 border-dashed border-gray-200 dark:border-gray-700 mr-4 transition-all duration-300 origin-top ${isExpanded ? 'scale-y-100 opacity-100 max-h-[2000px]' : 'scale-y-0 opacity-0 max-h-0 overflow-hidden'}`}>
                                            {dayLogs.map(log => {
                                                const isCreate = log.action === 'CREATED';
                                                const isUpdate = log.action === 'UPDATED';
                                                const isDelete = log.action === 'DELETED';
                                                const isLogin = log.action === 'LOGIN';

                                                return (
                                                    <div key={log.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-start gap-4 hover:shadow-md transition-shadow">
                                                        <div className={`mt-1 w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0 ${
                                                            isCreate ? 'bg-green-500' :
                                                                isUpdate ? 'bg-orange-500' :
                                                                    isDelete ? 'bg-red-500' :
                                                                        isLogin ? 'bg-blue-500' : 'bg-gray-500'
                                                        }`}>
                                                            {isCreate ? <Plus size={16} /> : isUpdate ? <Sparkles size={16} /> : isDelete ? <Trash2 size={16} /> : <UserIcon size={16} />}
                                                        </div>
                                                        <div>
                                                            <p className="text-gray-800 dark:text-gray-200 text-sm font-medium leading-relaxed">{log.details}</p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                             <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-md font-mono">
                                                                 {new Date(log.timestamp).toLocaleTimeString('fa-IR')}
                                                             </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            <TaskModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveTask}
                onDelete={handleDeleteTask}
                task={editingTask}
                users={users}
                currentUser={currentUser}
            />

        </Layout>
    );
};

export default App;
