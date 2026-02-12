
import React, { useState } from 'react';
import { Task, User } from '../types';
import { analyzeTasksWithAI, analyzeTeamPerformance, askAIGeneral } from '../services/geminiService';
import { Sparkles, Users, MessageSquare, Send, Bot, BarChart3, RefreshCw } from 'lucide-react';

interface AIAssistantProps {
    tasks: Task[];
    users: User[];
    currentUser: User;
}

type AITab = 'TASKS' | 'TEAM' | 'CHAT';

const AIAssistant: React.FC<AIAssistantProps> = ({ tasks, users, currentUser }) => {
    const [activeTab, setActiveTab] = useState<AITab>('TASKS');
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<string>('');
    const [chatInput, setChatInput] = useState('');
    const [chatHistory, setChatHistory] = useState<{role: 'user'|'ai', text: string}[]>([]);

    const isAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN';

    // Initial Load Logic (Optional: Auto-load tasks analysis)
    // We keep it manual to save API tokens unless user clicks.

    const handleAction = async () => {
        setLoading(true);
        setResponse('');
        try {
            if (activeTab === 'TASKS') {
                const res = await analyzeTasksWithAI(tasks.filter(t => t.status !== 'DONE'));
                setResponse(res);
            } else if (activeTab === 'TEAM') {
                const res = await analyzeTeamPerformance(users, tasks);
                setResponse(res);
            }
        } catch (e) {
            setResponse('خطایی رخ داد. لطفا مجدد تلاش کنید.');
        } finally {
            setLoading(false);
        }
    };

    const handleChat = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim()) return;

        const question = chatInput;
        setChatInput('');
        setChatHistory(prev => [...prev, { role: 'user', text: question }]);
        setLoading(true);

        try {
            const answer = await askAIGeneral(question, tasks);
            setChatHistory(prev => [...prev, { role: 'ai', text: answer }]);
        } catch (e) {
            setChatHistory(prev => [...prev, { role: 'ai', text: 'خطا در برقراری ارتباط.' }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white/70 dark:bg-gray-800/60 backdrop-blur-xl border border-white/60 dark:border-gray-700 rounded-[2.5rem] p-1 shadow-sm mb-10 overflow-hidden relative group">
            {/* Background Gradient Animation from User Request */}
            <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-r from-blue-500/5 to-purple-500/5 dark:from-blue-500/10 dark:to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>

            <div className="flex flex-col md:flex-row h-full">
                {/* Sidebar / Tabs */}
                <div className="w-full md:w-64 bg-white/50 dark:bg-gray-900/50 p-4 flex flex-row md:flex-col gap-2 border-l border-white/50 dark:border-gray-700/50 backdrop-blur-md z-10">
                    <div className="flex items-center gap-3 px-4 py-4 mb-2">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
                            <Bot size={24} />
                        </div>
                        <div>
                            <h3 className="font-black text-gray-800 dark:text-white leading-tight">هوش مصنوعی</h3>
                            <p className="text-[10px] text-gray-500 font-bold">دستیار هوشمند پروژه</p>
                        </div>
                    </div>

                    <button
                        onClick={() => { setActiveTab('TASKS'); setResponse(''); }}
                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-sm font-bold ${activeTab === 'TASKS' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:bg-white/40 dark:hover:bg-gray-800/40'}`}
                    >
                        <BarChart3 size={18} />
                        تحلیل پروژه
                    </button>

                    {isAdmin && (
                        <button
                            onClick={() => { setActiveTab('TEAM'); setResponse(''); }}
                            className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-sm font-bold ${activeTab === 'TEAM' ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm' : 'text-gray-500 hover:bg-white/40 dark:hover:bg-gray-800/40'}`}
                        >
                            <Users size={18} />
                            تحلیل تیم
                        </button>
                    )}

                    <button
                        onClick={() => { setActiveTab('CHAT'); }}
                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-sm font-bold ${activeTab === 'CHAT' ? 'bg-white dark:bg-gray-700 text-green-600 dark:text-green-400 shadow-sm' : 'text-gray-500 hover:bg-white/40 dark:hover:bg-gray-800/40'}`}
                    >
                        <MessageSquare size={18} />
                        چت با دستیار
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 p-6 relative min-h-[250px] flex flex-col">
                    {activeTab !== 'CHAT' ? (
                        <>
                            <div className="flex justify-between items-start mb-4 relative z-10">
                                <div>
                                    <h4 className="text-lg font-black text-gray-800 dark:text-white flex items-center gap-2">
                                        {activeTab === 'TASKS' ? 'وضعیت کلی کارها' : 'عملکرد اعضای تیم'}
                                        <Sparkles size={16} className="text-yellow-500" />
                                    </h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {activeTab === 'TASKS' ? 'تحلیل هوشمند وظایف باز و اولویت‌بندی شده.' : 'بررسی بهره‌وری و تعادل کار در تیم.'}
                                    </p>
                                </div>
                                <button
                                    onClick={handleAction}
                                    disabled={loading}
                                    className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:scale-105 transition-transform disabled:opacity-50"
                                >
                                    {loading ? <RefreshCw size={14} className="animate-spin"/> : <Sparkles size={14}/>}
                                    {response ? 'تحلیل مجدد' : 'شروع تحلیل'}
                                </button>
                            </div>

                            <div className="flex-1 bg-white/40 dark:bg-gray-900/30 rounded-3xl p-6 border border-white/50 dark:border-gray-700/50 relative overflow-y-auto custom-scrollbar">
                                {loading ? (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
                                        <p className="text-xs font-bold animate-pulse">در حال تفکر...</p>
                                    </div>
                                ) : response ? (
                                    <p className="text-sm text-gray-700 dark:text-gray-200 leading-8 whitespace-pre-wrap font-medium">
                                        {response}
                                    </p>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-60">
                                        <Bot size={48} className="mb-2" />
                                        <p className="text-sm font-bold">برای دریافت گزارش، دکمه تحلیل را بزنید.</p>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        // CHAT UI
                        <div className="flex flex-col h-full relative z-10">
                            <div className="flex-1 bg-white/40 dark:bg-gray-900/30 rounded-3xl p-4 border border-white/50 dark:border-gray-700/50 mb-4 overflow-y-auto custom-scrollbar max-h-[300px]">
                                {chatHistory.length === 0 ? (
                                    <div className="text-center text-gray-400 mt-10">
                                        <Bot size={32} className="mx-auto mb-2 opacity-50" />
                                        <p className="text-xs">هر سوالی دارید بپرسید! من در مورد پروژه و تسک‌ها آگاهم.</p>
                                    </div>
                                ) : (
                                    chatHistory.map((msg, i) => (
                                        <div key={i} className={`flex mb-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[80%] p-3 rounded-2xl text-sm leading-6 ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-none border border-gray-100 dark:border-gray-600'}`}>
                                                {msg.text}
                                            </div>
                                        </div>
                                    ))
                                )}
                                {loading && (
                                    <div className="flex justify-start mb-3">
                                        <div className="bg-white dark:bg-gray-700 px-4 py-2 rounded-2xl rounded-tl-none text-xs text-gray-500 animate-pulse">
                                            در حال نوشتن...
                                        </div>
                                    </div>
                                )}
                            </div>

                            <form onSubmit={handleChat} className="flex gap-2">
                                <input
                                    type="text"
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    placeholder="سوال خود را بپرسید..."
                                    className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 outline-none focus:border-blue-500 transition-colors text-sm"
                                />
                                <button type="submit" disabled={loading || !chatInput.trim()} className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-2xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                    <Send size={20} />
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AIAssistant;
