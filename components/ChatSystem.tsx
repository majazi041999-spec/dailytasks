
import React, { useState, useEffect, useRef } from 'react';
import { User, Message } from '../types';
import { MockBackend, generateUUID } from '../services/mockBackend';
import { Send, User as UserIcon, MessageSquare, Edit2, Trash2, X, Check, Search, Trash, Image as ImageIcon, Paperclip, FileText, Download, Phone, Video, Mic } from 'lucide-react';

interface ChatSystemProps {
    currentUser: User;
    users: User[];
}

const ChatSystem: React.FC<ChatSystemProps> = ({ currentUser, users }) => {
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);

    // Attachment State
    const [attachment, setAttachment] = useState<string | null>(null);
    const [attachmentType, setAttachmentType] = useState<'image' | 'file'>('image');
    const [attachmentName, setAttachmentName] = useState<string>('');

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const availableUsers = users.filter(u => u.id !== currentUser.id && u.name.toLowerCase().includes(searchTerm.toLowerCase()));

    useEffect(() => {
        if (selectedUser) {
            const freshUser = users.find(u => u.id === selectedUser.id);
            if (freshUser && JSON.stringify(freshUser) !== JSON.stringify(selectedUser)) {
                setSelectedUser(freshUser);
            }
        }
    }, [users, selectedUser]);

    useEffect(() => {
        const fetchMessages = async () => {
            if (selectedUser) {
                try {
                    const allMsgs = await MockBackend.getMessages(currentUser.id);
                    const conversation = allMsgs.filter(m =>
                        (m.senderId === currentUser.id && m.receiverId === selectedUser.id) ||
                        (m.senderId === selectedUser.id && m.receiverId === currentUser.id)
                    ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                    setMessages(conversation);
                } catch (e) {
                    console.error("Error polling messages:", e);
                }
            }
        };
        fetchMessages();
        const interval = setInterval(fetchMessages, 2000);
        return () => clearInterval(interval);
    }, [selectedUser, currentUser.id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        const textToSend = newMessage.trim();
        if ((!textToSend && !attachment) || !selectedUser) return;

        // Reset Input
        setNewMessage('');
        setAttachment(null);
        setAttachmentName('');
        inputRef.current?.focus();

        const msg: Message = {
            id: generateUUID(),
            senderId: currentUser.id,
            receiverId: selectedUser.id,
            content: textToSend,
            timestamp: new Date().toISOString(),
            isRead: false,
            attachment: attachment || undefined,
            attachmentType: attachment ? attachmentType : undefined,
            attachmentName: attachmentName || undefined
        };

        setMessages(prev => [...prev, msg]);

        try {
            await MockBackend.sendMessage(msg);
        } catch (err) {
            console.error("Failed to send message", err);
            setMessages(prev => prev.filter(m => m.id !== msg.id));
            setNewMessage(textToSend);
            alert("ارسال پیام ناموفق بود.");
        }
    };

    const startEdit = (msg: Message) => {
        setEditingMessageId(msg.id);
        setEditContent(msg.content);
    };

    const cancelEdit = () => {
        setEditingMessageId(null);
        setEditContent('');
    };

    const saveEdit = async (msg: Message) => {
        if (!editContent.trim()) return;
        const updatedMsg = { ...msg, content: editContent };
        try {
            await MockBackend.updateMessage(updatedMsg);
            setMessages(messages.map(m => m.id === msg.id ? updatedMsg : m));
            setEditingMessageId(null);
        } catch (err) {
            console.error("Failed to update message", err);
            alert("خطا در ویرایش پیام.");
        }
    };

    const handleDelete = async (msgId: string) => {
        if(!window.confirm('آیا از حذف این پیام اطمینان دارید؟')) return;
        try {
            await MockBackend.deleteMessage(msgId);
            setMessages(messages.filter(m => m.id !== msgId));
        } catch (err) {
            console.error("Failed to delete message", err);
            alert("خطا در حذف پیام.");
        }
    };

    const handleDeleteConversation = async () => {
        if (!selectedUser) return;
        if (!window.confirm('آیا مطمئن هستید؟ تمامی تاریخچه پیام‌ها با این کاربر برای همیشه پاک خواهد شد.')) return;

        try {
            await MockBackend.deleteConversation(currentUser.id, selectedUser.id);
            setMessages([]);
        } catch (err) {
            console.error("Failed to delete conversation", err);
            alert("خطا در حذف گفتگو.");
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
        const file = e.target.files?.[0];
        if (file) {
            // Limit size to 2MB to keep app lightweight
            if (file.size > 2 * 1024 * 1024) {
                alert("حجم فایل نباید بیشتر از ۲ مگابایت باشد.");
                return;
            }

            const reader = new FileReader();
            reader.onload = (evt) => {
                if (evt.target?.result) {
                    setAttachment(evt.target.result as string);
                    setAttachmentType(type);
                    setAttachmentName(file.name);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const formatMessageDay = (timestamp: string) => {
        return new Date(timestamp).toLocaleDateString('fa-IR', {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
        });
    };

    const shouldShowDateDivider = (index: number) => {
        if (index === 0) return true;
        const current = new Date(messages[index].timestamp).toDateString();
        const previous = new Date(messages[index - 1].timestamp).toDateString();
        return current !== previous;
    };

    return (
        <>
            {/* Image Zoom Modal */}
            {zoomedImage && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
                    onClick={() => setZoomedImage(null)}
                >
                    <img
                        src={zoomedImage}
                        className="max-w-[90vw] max-h-[90vh] object-contain rounded-2xl animate-pop shadow-2xl"
                        alt="Zoomed"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <button
                        className="absolute top-5 right-5 text-white/80 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all hover:scale-110 active:scale-95"
                        onClick={() => setZoomedImage(null)}
                    >
                        <X size={32} />
                    </button>
                </div>
            )}

            <div className="flex h-[calc(100vh-8rem)] gap-6 animate-fade-scale">
                {/* Contact List Side */}
                <div className="w-full md:w-1/3 bg-white/45 dark:bg-gray-800/45 backdrop-blur-3xl rounded-[2.5rem] border border-white/60 dark:border-gray-700/60 shadow-[0_20px_70px_rgba(15,23,42,0.18)] overflow-hidden flex flex-col relative transition-all duration-500 hover:shadow-[0_30px_90px_rgba(59,130,246,0.22)]">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -z-10"></div>

                    <div className="p-6 border-b border-gray-100 dark:border-gray-700/50">
                        <h2 className="font-black text-gray-800 dark:text-white text-2xl mb-4 tracking-tight">پیام‌ها</h2>
                        <div className="relative group">
                            <Search className="absolute right-4 top-3.5 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="جستجوی همکار..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-white/50 dark:bg-gray-900/50 rounded-2xl py-3 pl-4 pr-12 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-sm font-bold text-gray-700 dark:text-gray-200 focus:bg-white dark:focus:bg-gray-900"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                        {availableUsers.map(u => (
                            <div
                                key={u.id}
                                onClick={() => setSelectedUser(u)}
                                className={`flex items-center gap-4 p-4 rounded-[1.5rem] cursor-pointer transition-all duration-300 group ${selectedUser?.id === u.id ? 'bg-white/85 dark:bg-gray-700/85 shadow-lg shadow-blue-900/10 scale-[1.02] border border-white/80 dark:border-blue-900/40 ring-1 ring-blue-300/40' : 'hover:bg-white/40 dark:hover:bg-gray-700/40 hover:scale-[1.02] border border-transparent'}`}
                            >
                                <div className="relative" onClick={(e) => { e.stopPropagation(); setZoomedImage(u.avatar); }}>
                                    <img src={u.avatar} className="w-12 h-12 rounded-full object-cover shadow-md border-2 border-white dark:border-gray-600 hover:scale-110 transition-transform duration-300 ring-2 ring-white/50 dark:ring-gray-500/40" alt="" />
                                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-gray-700 rounded-full animate-pulse-slow"></div>
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-center mb-1">
                                        <p className="font-bold text-gray-800 dark:text-gray-100 text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{u.name}</p>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate font-medium opacity-80">
                                        {u.role === 'ADMIN' ? 'مدیر بخش' : u.role === 'SUPER_ADMIN' ? 'مدیر کل' : 'توسعه‌دهنده'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Chat Area */}
                <div className="hidden md:flex flex-1 bg-white/35 dark:bg-gray-800/35 backdrop-blur-3xl rounded-[2.5rem] border border-white/60 dark:border-gray-700/50 shadow-[0_20px_80px_rgba(2,6,23,0.22)] overflow-hidden flex-col relative transition-all duration-500">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23000000\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}></div>

                    {selectedUser ? (
                        <>
                            <div className="p-5 bg-gradient-to-b from-white/75 to-white/60 dark:from-gray-900/75 dark:to-gray-900/60 backdrop-blur-xl border-b border-white/50 dark:border-white/10 flex items-center justify-between z-10 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
                                <div className="flex items-center gap-4">
                                    <div className="relative cursor-pointer group" onClick={() => setZoomedImage(selectedUser.avatar)}>
                                        <img src={selectedUser.avatar} className="w-12 h-12 rounded-full shadow-md border-2 border-white dark:border-gray-700 group-hover:scale-110 transition-transform duration-300" alt="" />
                                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full animate-pulse"></div>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white text-lg">{selectedUser.name}</h3>
                                        <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-bold">
                                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                            آنلاین
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button className="p-2.5 rounded-xl bg-white/70 dark:bg-gray-800/70 border border-white/60 dark:border-gray-700 text-sky-500 hover:scale-105 transition-all" title="تماس صوتی">
                                        <Phone size={16} />
                                    </button>
                                    <button className="p-2.5 rounded-xl bg-white/70 dark:bg-gray-800/70 border border-white/60 dark:border-gray-700 text-indigo-500 hover:scale-105 transition-all" title="تماس تصویری">
                                        <Video size={16} />
                                    </button>
                                    <button className="p-2.5 rounded-xl bg-white/70 dark:bg-gray-800/70 border border-white/60 dark:border-gray-700 text-emerald-500 hover:scale-105 transition-all" title="ویس">
                                        <Mic size={16} />
                                    </button>
                                    <button
                                        onClick={handleDeleteConversation}
                                        className="bg-red-50/90 dark:bg-red-900/20 text-red-500 p-3 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm flex items-center gap-2 text-xs font-bold hover:scale-105 active:scale-95"
                                        title="حذف کل گفتگو"
                                    >
                                        <Trash size={18} />
                                        حذف گفتگو
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar z-0 relative bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.07),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(16,185,129,0.08),transparent_38%),radial-gradient(circle_at_50%_80%,rgba(139,92,246,0.07),transparent_42%)]">
                                {messages.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-60 animate-pop">
                                        <MessageSquare size={48} className="mb-2" />
                                        <p>پیامی وجود ندارد</p>
                                    </div>
                                )}
                                {messages.map((msg, index) => {
                                    const isMe = msg.senderId === currentUser.id;
                                    const isEditing = editingMessageId === msg.id;
                                    const groupedWithPrevious = index > 0 && messages[index - 1].senderId === msg.senderId;

                                    return (
                                        <React.Fragment key={msg.id}>
                                            {shouldShowDateDivider(index) && (
                                                <div className="sticky top-2 z-10 flex justify-center py-1 animate-fade-scale">
                                                    <span className="text-[11px] px-3 py-1.5 rounded-full bg-white/80 dark:bg-gray-800/85 border border-white/80 dark:border-gray-700 text-gray-500 dark:text-gray-300 backdrop-blur-md shadow-sm">
                                                        {formatMessageDay(msg.timestamp)}
                                                    </span>
                                                </div>
                                            )}

                                            <div className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} group animate-slide-up-fade ${groupedWithPrevious ? 'mt-1' : 'mt-3'}`} style={{ animationDelay: `${Math.min(index * 50, 300)}ms` }}>
                                                <div className={`relative max-w-[78%] min-w-[140px] shadow-sm transition-all duration-300 flex flex-col p-3 gap-2 backdrop-blur-[1px] ${
                                                    isMe
                                                        ? 'bg-gradient-to-br from-[#34C759] to-[#2FB350] text-white rounded-[22px] rounded-br-[8px] shadow-[0_8px_24px_rgba(52,199,89,0.35)] hover:shadow-[0_12px_30px_rgba(52,199,89,0.45)]'
                                                        : 'bg-[#F2F2F7]/95 dark:bg-gray-700/95 text-gray-800 dark:text-gray-100 rounded-[22px] rounded-bl-[8px] border border-white/80 dark:border-gray-600 hover:shadow-md'
                                                }`}>
                                                    <svg className={`absolute top-0 w-4 h-4 ${isMe ? '-right-2 fill-[#2FB350]' : '-left-2 fill-white dark:fill-gray-700'} ${!isMe && 'scale-x-[-1]'}`} viewBox="0 0 10 10">
                                                        <path d="M0 0 L10 0 L0 10 Z" />
                                                    </svg>
                                                    {isMe && <div className="pointer-events-none absolute inset-x-3 top-1 h-4 rounded-full bg-white/20 blur-md" />}

                                                    <div className="px-1 break-words">
                                                        {msg.attachment && (
                                                            <div className="mb-2 rounded-xl overflow-hidden bg-black/10 dark:bg-black/20">
                                                                {msg.attachmentType === 'image' ? (
                                                                    <img
                                                                        src={msg.attachment}
                                                                        alt="attached"
                                                                        className="max-w-full h-auto max-h-60 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                                                        loading="lazy"
                                                                        onClick={() => setZoomedImage(msg.attachment!)}
                                                                    />
                                                                ) : (
                                                                    <a
                                                                        href={msg.attachment}
                                                                        download={msg.attachmentName || 'file'}
                                                                        className={`flex items-center gap-3 p-3 transition-colors ${isMe ? 'bg-blue-500 hover:bg-blue-400' : 'bg-gray-50 dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-500'}`}
                                                                    >
                                                                        <div className={`p-2 rounded-lg ${isMe ? 'bg-white/20' : 'bg-blue-100 dark:bg-gray-700'}`}>
                                                                            <FileText size={24} className={isMe ? 'text-white' : 'text-blue-500 dark:text-blue-400'} />
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className={`text-sm font-bold truncate ${isMe ? 'text-white' : 'text-gray-800 dark:text-white'}`}>{msg.attachmentName || 'فایل ضمیمه'}</p>
                                                                            <span className={`text-[10px] flex items-center gap-1 ${isMe ? 'text-blue-100' : 'text-blue-500 dark:text-blue-300'}`}>
                                                                                <Download size={10} /> دانلود
                                                                            </span>
                                                                        </div>
                                                                    </a>
                                                                )}
                                                            </div>
                                                        )}

                                                        {isEditing ? (
                                                            <div className="flex flex-col gap-2 animate-in fade-in zoom-in-95">
                                                                <textarea
                                                                    value={editContent}
                                                                    onChange={(e) => setEditContent(e.target.value)}
                                                                    className="bg-white/20 text-inherit rounded-lg px-2 py-1 outline-none w-full border border-white/30 text-sm resize-none min-h-[60px]"
                                                                    autoFocus
                                                                />
                                                                <div className="flex gap-2 justify-end">
                                                                    <button onClick={cancelEdit} className="p-1 hover:bg-white/20 rounded transition-colors"><X size={16}/></button>
                                                                    <button onClick={() => saveEdit(msg)} className="p-1 hover:bg-white/20 rounded transition-colors text-green-300 hover:text-green-100"><Check size={16}/></button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <p dir="auto" className="text-sm leading-7 whitespace-pre-wrap">{msg.content}</p>
                                                        )}

                                                        {isEditing ? (
                                                            <div className="flex flex-col gap-2 animate-in fade-in zoom-in-95">
                                                                <textarea
                                                                    value={editContent}
                                                                    onChange={(e) => setEditContent(e.target.value)}
                                                                    className="bg-white/20 text-inherit rounded-lg px-2 py-1 outline-none w-full border border-white/30 text-sm resize-none min-h-[60px]"
                                                                    autoFocus
                                                                />
                                                                <div className="flex gap-2 justify-end">
                                                                    <button onClick={cancelEdit} className="p-1 hover:bg-white/20 rounded transition-colors"><X size={16}/></button>
                                                                    <button onClick={() => saveEdit(msg)} className="p-1 hover:bg-white/20 rounded transition-colors text-green-300 hover:text-green-100"><Check size={16}/></button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <p dir="auto" className="text-sm leading-7 whitespace-pre-wrap">{msg.content}</p>
                                                        )}
                                                    </div>

                                                    <div className={`flex items-center justify-between mt-auto pt-1 ${isMe ? 'border-t border-white/10' : 'border-t border-gray-100 dark:border-gray-600'}`}>
                                                        <div className="flex items-center gap-1 h-6">
                                                            {isMe && !isEditing && (
                                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0">
                                                                    <button onClick={() => startEdit(msg)} className="p-1.5 hover:bg-white/20 rounded-md transition-colors text-white/90 hover:text-white flex items-center justify-center" title="ویرایش">
                                                                        <Edit2 size={12}/>
                                                                    </button>
                                                                    <button onClick={() => handleDelete(msg.id)} className="p-1.5 hover:bg-white/20 text-red-200 hover:text-red-50 rounded-md transition-colors flex items-center justify-center" title="حذف">
                                                                        <Trash2 size={12}/>
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className={`flex items-center gap-1 opacity-70 ${isMe ? 'text-emerald-100' : 'text-gray-400 dark:text-gray-400'} shrink-0 ml-1`}>
                                                            <span className="text-[10px] font-mono whitespace-nowrap">
                                                                {new Date(msg.timestamp).toLocaleTimeString('fa-IR', {hour: '2-digit', minute:'2-digit'})}
                                                            </span>
                                                            {isMe && <Check size={12} className={msg.isRead ? 'text-blue-200' : ''} />}
                                                            {isEditing && <span className="text-[9px]">(ویرایش)</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </React.Fragment>
                                    )
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* New Input Area */}
                            <div className="p-4 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md border-t border-white/30 dark:border-white/10 z-10 flex flex-col gap-2 animate-in slide-in-from-bottom-2 duration-500 relative">
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-1 rounded-full bg-white/70 dark:bg-gray-600/80" />

                                {/* Preview Area */}
                                {attachment && (
                                    <div className="flex items-center gap-3 bg-white dark:bg-gray-800 p-2 rounded-xl w-fit shadow-sm border border-gray-200 dark:border-gray-700 animate-pop origin-bottom-left">
                                        <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                                            {attachmentType === 'image' ? (
                                                <img src={attachment} alt="preview" className="w-full h-full object-cover" />
                                            ) : (
                                                <FileText size={20} className="text-gray-500" />
                                            )}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-gray-700 dark:text-gray-200 max-w-[150px] truncate">{attachmentName}</span>
                                            <span className="text-[10px] text-gray-400">{attachmentType === 'image' ? 'تصویر' : 'فایل'}</span>
                                        </div>
                                        <button onClick={() => { setAttachment(null); setAttachmentName(''); }} className="bg-red-50 text-red-500 p-1 rounded-full hover:bg-red-100 ml-2 transition-transform hover:scale-110">
                                            <X size={14} />
                                        </button>
                                    </div>
                                )}

                                <form onSubmit={handleSend} className="flex gap-3 items-end">
                                    <div className="flex gap-2 mb-1">
                                        <label className="p-3 bg-white/50 dark:bg-gray-800/50 hover:bg-blue-50 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-blue-500 rounded-full cursor-pointer transition-all shadow-sm group relative hover:scale-110 active:scale-95" title="ارسال تصویر / گیف">
                                            <ImageIcon size={20} />
                                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, 'image')} />
                                        </label>
                                        <label className="p-3 bg-white/50 dark:bg-gray-800/50 hover:bg-orange-50 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-orange-500 rounded-full cursor-pointer transition-all shadow-sm hover:scale-110 active:scale-95" title="ارسال فایل">
                                            <Paperclip size={20} />
                                            <input type="file" className="hidden" onChange={(e) => handleFileSelect(e, 'file')} />
                                        </label>
                                    </div>

                                    <div className="flex-1 bg-white/75 dark:bg-gray-800/75 rounded-[1.8rem] p-1 border border-white/80 dark:border-gray-600 flex items-center shadow-[inset_0_2px_10px_rgba(255,255,255,0.55)] focus-within:ring-2 focus-within:ring-sky-400/30 transition-all focus-within:bg-white dark:focus-within:bg-gray-800">
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={newMessage}
                                            onChange={e => setNewMessage(e.target.value)}
                                            placeholder="پیام خود را بنویسید..."
                                            className="flex-1 bg-transparent px-4 py-3 outline-none text-sm text-gray-900 dark:text-white placeholder-gray-400"
                                        />
                                    </div>
                                    <button type="submit" disabled={!newMessage.trim() && !attachment} className="bg-gradient-to-tr from-sky-500 to-indigo-500 hover:shadow-lg hover:shadow-sky-400/40 text-white p-4 rounded-full transition-all transform hover:scale-110 active:scale-90 mb-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">
                                        <Send size={20} className={newMessage.trim() || attachment ? "translate-x-0.5 translate-y-[-1px]" : ""} />
                                    </button>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 relative animate-in fade-in duration-700">
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/10 pointer-events-none"></div>
                            <div className="w-32 h-32 bg-gray-100 dark:bg-gray-700/50 rounded-full flex items-center justify-center mb-6 animate-bounce-subtle shadow-inner">
                                <MessageSquare size={64} className="text-gray-300 dark:text-gray-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-2">گفتگو را آغاز کنید</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-500 max-w-xs text-center leading-relaxed">
                                یک کاربر را از لیست سمت راست انتخاب کنید تا تاریخچه پیام‌ها نمایش داده شود.
                            </p>
                            <div className="mt-8 flex gap-2">
                                <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 animate-pulse"></div>
                                <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 animate-pulse delay-100"></div>
                                <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 animate-pulse delay-200"></div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default ChatSystem;
