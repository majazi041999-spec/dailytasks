
import React, { useState, useEffect, useRef } from 'react';
import { Task, TaskStatus, Priority, User, SubTask, Alarm, TaskUpdate } from '../types';
import { X, Save, Trash2, CheckSquare, Plus, Bell, BellRing, Activity, Send, Paperclip, Sparkles, FileText, Download, Image as ImageIcon, Clock, Lock } from 'lucide-react';
import { generateUUID } from '../services/mockBackend';
import { generateSubtasks } from '../services/geminiService';
import RichContentBlock from './RichContentBlock';
import JalaliDatePicker from './JalaliDatePicker';

interface TaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (task: Task) => void;
    onDelete?: (taskId: string) => void;
    task: Task | null;
    users: User[];
    currentUser: User;
}

const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, onSave, onDelete, task, users, currentUser }) => {
    const [formData, setFormData] = useState<Partial<Task>>({});
    const [newSubtask, setNewSubtask] = useState('');

    // Date & Time State
    const [selectedDateIso, setSelectedDateIso] = useState<string>(new Date().toISOString());
    const [selectedTime, setSelectedTime] = useState<string>('12:00');

    // Custom Alarm State
    const [alarmValue, setAlarmValue] = useState<number>(15);
    const [alarmUnit, setAlarmUnit] = useState<number>(1);

    const [activeTab, setActiveTab] = useState<'info' | 'updates'>('info');

    // Updates/Reporting State
    const [updateText, setUpdateText] = useState('');
    const [updateAttachment, setUpdateAttachment] = useState<string | null>(null);
    const [updateAttachmentName, setUpdateAttachmentName] = useState<string>('');
    const [updateAttachmentType, setUpdateAttachmentType] = useState<'image' | 'file'>('image');
    const [manualProgress, setManualProgress] = useState<number>(0); // NEW: Manual Progress

    const [isGeneratingSubtasks, setIsGeneratingSubtasks] = useState(false);
    const updatesEndRef = useRef<HTMLDivElement>(null);

    // 1. INITIALIZATION: Run when modal opens or Task ID changes (switch to another task)
    useEffect(() => {
        if (isOpen && task) {
            setFormData({ ...task });
            if (task.dueDate) {
                const d = new Date(task.dueDate);
                setSelectedDateIso(task.dueDate);
                const hours = String(d.getHours()).padStart(2, '0');
                const minutes = String(d.getMinutes()).padStart(2, '0');
                setSelectedTime(`${hours}:${minutes}`);
            }

            const initialProgress = task.updates && task.updates.length > 0
                ? task.updates[task.updates.length - 1].progressValue || 0
                : (task.subtasks && task.subtasks.length > 0
                    ? Math.round((task.subtasks.filter(s => s.isCompleted).length / task.subtasks.length) * 100)
                    : 0);
            setManualProgress(initialProgress);
            setActiveTab('info');
        } else if (isOpen && !task) {
            // Create New
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');

            setFormData({
                title: '',
                description: '',
                richDescription: [],
                priority: Priority.MEDIUM,
                status: TaskStatus.TODO,
                assigneeId: currentUser.id,
                subtasks: [],
                alarms: [],
                updates: []
            });
            setSelectedDateIso(now.toISOString());
            setSelectedTime(`${hours}:${minutes}`);
            setManualProgress(0);
            setActiveTab('info');
        }
    }, [isOpen, task?.id]); // Only refire if ID changes or modal re-opens

    // 2. REAL-TIME SYNC: Update reports/subtasks AND core fields (Priority/Assignee) from props if changed by others
    useEffect(() => {
        if (isOpen && task) {
            setFormData(prev => ({
                ...prev,
                updates: task.updates,
                subtasks: task.subtasks,
                status: task.status,
                // Sync core fields (Priority, Assignee, Date) if changed externally
                // We rely on the parent (App.tsx) to only pass 'task' if it deeply changed.
                priority: task.priority,
                assigneeId: task.assigneeId,
                dueDate: task.dueDate
            }));

            if (task.dueDate) {
                const d = new Date(task.dueDate);
                // Only update if drastically different to avoid typing jitter, though props usually mean server update
                if (d.toISOString() !== selectedDateIso) {
                    setSelectedDateIso(task.dueDate);
                    const hours = String(d.getHours()).padStart(2, '0');
                    const minutes = String(d.getMinutes()).padStart(2, '0');
                    setSelectedTime(`${hours}:${minutes}`);
                }
            }
        }
    }, [task?.updates, task?.subtasks, task?.status, task?.priority, task?.assigneeId, task?.dueDate]);


    useEffect(() => {
        if (activeTab === 'updates') {
            setTimeout(() => {
                updatesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    }, [activeTab, formData.updates]);

    if (!isOpen) return null;

    // --- PERMISSIONS LOGIC ---
    // A User can edit core details ONLY if they created the task OR they are a Super Admin.
    // Assignees can ONLY change Status, Subtasks, and add Reports.
    const isCreator = (task?.assignedById || currentUser.id) === currentUser.id;
    const isAssignee = formData.assigneeId === currentUser.id;
    const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';

    const canEditCore = isCreator || isSuperAdmin || !task; // !task means we are creating a new one

    const constructTask = (): Task => {
        const finalDate = new Date(selectedDateIso);
        const [hours, minutes] = selectedTime.split(':').map(Number);
        finalDate.setHours(hours, minutes, 0, 0);

        const plainDesc = formData.richDescription
            ? formData.richDescription.filter(b => b.type === 'text').map(b => b.content).join(' ')
            : formData.description || '';

        return {
            id: task?.id || generateUUID(),
            title: formData.title || '',
            description: plainDesc.substring(0, 200) + (plainDesc.length > 200 ? '...' : ''),
            richDescription: formData.richDescription || [],
            priority: formData.priority || Priority.MEDIUM,
            status: formData.status || TaskStatus.TODO,
            assigneeId: formData.assigneeId || currentUser.id,
            assignedById: task?.assignedById || currentUser.id,
            dueDate: finalDate.toISOString(),
            createdAt: task?.createdAt || new Date().toISOString(),
            tags: formData.tags || [],
            subtasks: formData.subtasks || [],
            alarms: formData.alarms || [],
            updates: formData.updates || []
        };
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title) return;
        onSave(constructTask());
        onClose();
    };

    // --- SUBTASK LOGIC (FIXED STATE UPDATES) ---
    const handleAddSubtask = () => {
        if(!newSubtask.trim()) return;
        const sub: SubTask = {
            id: generateUUID(),
            title: newSubtask,
            isCompleted: false
        };
        // Use functional update to ensure we have the latest state
        setFormData(prev => ({
            ...prev,
            subtasks: [...(prev.subtasks || []), sub]
        }));
        setNewSubtask('');
    };

    const handleAiSubtasks = async () => {
        if (!formData.title) {
            alert("لطفا ابتدا عنوان تسک را وارد کنید.");
            return;
        }
        setIsGeneratingSubtasks(true);
        const suggestions = await generateSubtasks(formData.title);
        const newSubtasks = suggestions.map(s => ({
            id: generateUUID(),
            title: s,
            isCompleted: false
        }));
        setFormData(prev => ({
            ...prev,
            subtasks: [...(prev.subtasks || []), ...newSubtasks]
        }));
        setIsGeneratingSubtasks(false);
    };

    const toggleSubtask = (id: string) => {
        setFormData(prev => ({
            ...prev,
            subtasks: prev.subtasks?.map(s => s.id === id ? { ...s, isCompleted: !s.isCompleted } : s)
        }));
    };

    const deleteSubtask = (id: string) => {
        setFormData(prev => ({
            ...prev,
            subtasks: prev.subtasks?.filter(s => s.id !== id)
        }));
    };

    const handleAddAlarm = () => {
        if (!canEditCore) return;
        const offsetMinutes = alarmValue * alarmUnit;
        const alarm: Alarm = {
            id: generateUUID(),
            offsetMinutes: offsetMinutes,
            isFired: false
        };
        setFormData(prev => ({ ...prev, alarms: [...(prev.alarms || []), alarm] }));
    };

    const deleteAlarm = (id: string) => {
        if (!canEditCore) return;
        setFormData(prev => ({ ...prev, alarms: prev.alarms?.filter(a => a.id !== id) }));
    };

    const setDateToToday = () => {
        if (!canEditCore) return;
        const now = new Date();
        setSelectedDateIso(now.toISOString());
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        setSelectedTime(`${hours}:${minutes}`);
    };

    // --- REPORTING SYSTEM LOGIC ---

    const handleAddUpdate = async () => {
        if (!updateText.trim() && !updateAttachment) return;

        const newUpdate: TaskUpdate = {
            id: generateUUID(),
            userId: currentUser.id,
            content: updateText,
            timestamp: new Date().toISOString(),
            attachment: updateAttachment || undefined,
            attachmentName: updateAttachmentName || undefined,
            attachmentType: updateAttachmentType,
            progressValue: manualProgress // Use manual progress
        };

        // Update Local State Immediately
        const updatedList = [...(formData.updates || []), newUpdate];
        setFormData(prev => ({...prev, updates: updatedList}));

        const currentTaskState = constructTask();
        const taskToSave = { ...currentTaskState, updates: updatedList };

        // Call onSave (which saves to backend) but DO NOT CLOSE modal
        onSave(taskToSave);

        setUpdateText('');
        setUpdateAttachment(null);
        setUpdateAttachmentName('');
    };

    const handleUpdateFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
        const file = e.target.files?.[0];
        if (file) {
            setUpdateAttachmentName(file.name);
            setUpdateAttachmentType(type);
            const reader = new FileReader();
            reader.onload = (evt) => {
                if (evt.target?.result) setUpdateAttachment(evt.target.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    // Logic for showing 'IN_REVIEW':
    const showInReview = !isCreator || (formData.assigneeId === currentUser.id);

    // Logic for showing 'DONE':
    const showDone = isCreator || currentUser.role === 'SUPER_ADMIN';

    const assignableUsers = users.filter(u => {
        if (currentUser.role === 'SUPER_ADMIN') return true;
        if (currentUser.role === 'ADMIN') return u.role === 'USER' || u.id === currentUser.id;
        return u.id === currentUser.id;
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-white/10 dark:bg-black/40 backdrop-blur-md transition-opacity" onClick={onClose}></div>
            <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] w-full max-w-2xl relative z-10 overflow-hidden transform transition-all scale-100 border border-white/50 dark:border-gray-600 h-[90vh] flex flex-col">

                {/* Header */}
                <div className="px-8 py-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-white/40 dark:bg-gray-800/40">
                    <h2 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight flex items-center gap-2">
                        {task ? 'جزئیات پروژه' : 'پروژه جدید'}
                        {!canEditCore && task && (
                            <span title="فقط ایجاد کننده می‌تواند ویرایش کند">
                        <Lock size={16} className="text-gray-400" />
                      </span>
                        )}
                    </h2>
                    <div className="flex gap-2">
                        {task && (
                            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
                                <button onClick={() => setActiveTab('info')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'info' ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500'}`}>جزئیات</button>
                                <button onClick={() => setActiveTab('updates')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${activeTab === 'updates' ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
                                    <Activity size={14} />
                                    روند کار
                                    {formData.updates && formData.updates.length > 0 && <span className="w-2 h-2 rounded-full bg-red-500"></span>}
                                </button>
                            </div>
                        )}
                        <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors p-2 bg-white dark:bg-gray-700 rounded-full shadow-sm">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* INFO TAB */}
                {activeTab === 'info' ? (
                    <div className="flex flex-col flex-1 overflow-hidden">
                        <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">عنوان وظیفه</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={e => setFormData(prev => ({...prev, title: e.target.value}))}
                                    disabled={!canEditCore}
                                    className={`w-full px-4 py-4 rounded-2xl bg-white dark:bg-gray-900 border-none shadow-sm outline-none transition-all font-bold text-gray-800 dark:text-white text-lg ${!canEditCore ? 'opacity-60 cursor-not-allowed' : 'focus:ring-4 focus:ring-blue-500/20'}`}
                                    placeholder="عنوان تسک..."
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">اولویت</label>
                                    <select
                                        value={formData.priority}
                                        onChange={e => setFormData(prev => ({...prev, priority: e.target.value as Priority}))}
                                        disabled={!canEditCore}
                                        className={`w-full px-4 py-3 rounded-2xl bg-white dark:bg-gray-900 text-gray-800 dark:text-white border-none shadow-sm outline-none ${!canEditCore ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    >
                                        <option value={Priority.LOW}>پایین</option>
                                        <option value={Priority.MEDIUM}>متوسط</option>
                                        <option value={Priority.HIGH}>بالا</option>
                                        <option value={Priority.CRITICAL}>بحرانی</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">وضعیت</label>
                                    <select
                                        value={formData.status}
                                        onChange={e => setFormData(prev => ({...prev, status: e.target.value as TaskStatus}))}
                                        className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-gray-900 text-gray-800 dark:text-white border-none shadow-sm outline-none"
                                    >
                                        <option value={TaskStatus.TODO}>انجام نشده</option>
                                        <option value={TaskStatus.IN_PROGRESS}>در حال انجام</option>

                                        {/* Hide IN_REVIEW for Manager (Assigner) unless it's their own task */}
                                        {showInReview && <option value={TaskStatus.IN_REVIEW}>درخواست بررسی (اتمام کار)</option>}

                                        {/* Only Show DONE for Manager (Assigner) or Admin */}
                                        {showDone && <option value={TaskStatus.DONE}>تایید و بسته شده ✅</option>}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">مسئول انجام</label>
                                    <select
                                        value={formData.assigneeId}
                                        onChange={e => setFormData(prev => ({...prev, assigneeId: e.target.value}))}
                                        disabled={!canEditCore}
                                        className={`w-full px-4 py-3 rounded-2xl bg-white dark:bg-gray-900 text-gray-800 dark:text-white border-none shadow-sm outline-none ${!canEditCore ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    >
                                        {assignableUsers.map(u => (
                                            <option key={u.id} value={u.id}>
                                                {u.name} {u.id === currentUser.id ? '(وظیفه شخصی)' :
                                                u.role === 'SUPER_ADMIN' ? '(مدیر کل)' :
                                                    u.role === 'ADMIN' ? '(مدیر)' : '(کارمند)'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className={!canEditCore ? 'opacity-60 pointer-events-none' : ''}>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">تاریخ و ساعت سررسید</label>
                                        {canEditCore && (
                                            <button
                                                type="button"
                                                onClick={setDateToToday}
                                                className="text-[10px] text-blue-500 hover:text-blue-600 font-bold bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-md transition-colors"
                                            >
                                                اکنون
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <JalaliDatePicker
                                                value={selectedDateIso}
                                                onChange={setSelectedDateIso}
                                            />
                                        </div>
                                        <div className="w-24 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center px-2">
                                            <Clock size={16} className="text-gray-400 ml-1" />
                                            <input
                                                type="time"
                                                value={selectedTime}
                                                onChange={(e) => setSelectedTime(e.target.value)}
                                                disabled={!canEditCore}
                                                className="bg-transparent outline-none w-full text-center font-bold text-sm text-gray-800 dark:text-white py-2"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Subtasks */}
                            <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                                <div className="flex justify-between items-center mb-3">
                                    <label className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase"><CheckSquare size={14} /> چک‌لیست / زیرتسک‌ها</label>
                                    <button
                                        type="button"
                                        onClick={handleAiSubtasks}
                                        disabled={isGeneratingSubtasks}
                                        className="flex items-center gap-1 text-[10px] font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 px-2 py-1 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors"
                                    >
                                        <Sparkles size={12} />
                                        {isGeneratingSubtasks ? '...' : 'پیشنهاد هوشمند'}
                                    </button>
                                </div>
                                <div className="space-y-2 mb-3">
                                    {formData.subtasks?.map(sub => (
                                        <div key={sub.id} className="flex items-center gap-3 bg-white dark:bg-gray-900 p-2 rounded-xl border border-gray-100 dark:border-gray-700">
                                            <div onClick={() => toggleSubtask(sub.id)} className={`w-5 h-5 rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${sub.isCompleted ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-600'}`}>
                                                {sub.isCompleted && <X className="rotate-45 text-white" size={14} />}
                                            </div>
                                            <span className={`flex-1 text-sm font-medium ${sub.isCompleted ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-300'}`}>{sub.title}</span>
                                            <button type="button" onClick={() => deleteSubtask(sub.id)} className="text-gray-300 hover:text-red-500"><X size={14}/></button>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newSubtask}
                                        onChange={e => setNewSubtask(e.target.value)}
                                        placeholder="افزودن مورد جدید..."
                                        className="flex-1 bg-white dark:bg-gray-900 text-sm px-3 py-2 rounded-xl outline-none border border-transparent focus:border-blue-200 dark:text-white"
                                        onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), handleAddSubtask())}
                                    />
                                    <button type="button" onClick={handleAddSubtask} className="bg-blue-500 text-white p-2 rounded-xl hover:bg-blue-600 shadow-sm"><Plus size={18}/></button>
                                </div>
                            </div>

                            {/* Alarms */}
                            <div className="bg-orange-50/50 dark:bg-orange-900/10 p-4 rounded-2xl border border-orange-100 dark:border-orange-900/30">
                                <label className="flex items-center gap-2 text-orange-600 dark:text-orange-400 text-xs font-bold mb-3 uppercase"><Bell size={14} /> آلارم و یادآور</label>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {formData.alarms?.map(alarm => (
                                        <div key={alarm.id} className="bg-white dark:bg-gray-900 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 shadow-sm">
                                            <BellRing size={12} className="text-orange-500" />
                                            {alarm.offsetMinutes === 0 ? 'در زمان سررسید' :
                                                alarm.offsetMinutes % 1440 === 0 ? `${alarm.offsetMinutes / 1440} روز قبل` :
                                                    alarm.offsetMinutes % 60 === 0 ? `${alarm.offsetMinutes / 60} ساعت قبل` :
                                                        `${alarm.offsetMinutes} دقیقه قبل`}
                                            {canEditCore && <button type="button" onClick={() => deleteAlarm(alarm.id)} className="hover:text-red-500"><X size={12}/></button>}
                                        </div>
                                    ))}
                                </div>
                                {canEditCore ? (
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            min="1"
                                            value={alarmValue}
                                            onChange={e => setAlarmValue(Math.max(1, parseInt(e.target.value) || 1))}
                                            className="w-20 bg-white dark:bg-gray-900 text-sm px-3 py-2 rounded-xl outline-none border border-transparent focus:border-orange-200 dark:text-white text-center font-bold"
                                        />
                                        <select
                                            value={alarmUnit}
                                            onChange={e => setAlarmUnit(Number(e.target.value))}
                                            className="flex-1 bg-white dark:bg-gray-900 text-sm px-3 py-2 rounded-xl outline-none border border-transparent focus:border-orange-200 dark:text-white"
                                        >
                                            <option value={1}>دقیقه قبل</option>
                                            <option value={60}>ساعت قبل</option>
                                            <option value={1440}>روز قبل</option>
                                        </select>
                                        <button type="button" onClick={handleAddAlarm} className="bg-orange-500 text-white p-2 rounded-xl hover:bg-orange-600 shadow-sm"><Plus size={18}/></button>
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-400 italic">فقط ایجاد کننده می‌تواند آلارم‌ها را تغییر دهد.</p>
                                )}
                            </div>

                            {/* Rich Description Editor */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">توضیحات تکمیلی پروژه</label>
                                <div className="bg-white dark:bg-gray-900/30 rounded-2xl p-2 border border-gray-100 dark:border-gray-700">
                                    <RichContentBlock
                                        blocks={formData.richDescription || []}
                                        onChange={(blocks) => setFormData(prev => ({...prev, richDescription: blocks}))}
                                        readOnly={!canEditCore}
                                    />
                                </div>
                            </div>
                        </form>

                        <div className="flex gap-4 p-6 border-t border-gray-100 dark:border-gray-700 bg-white/40 dark:bg-gray-800/40 mt-auto">
                            <button onClick={handleSubmit} className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-lg hover:shadow-blue-500/40 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02]">
                                <Save size={20} />
                                {task ? 'بروزرسانی وظیفه' : 'ایجاد وظیفه'}
                            </button>
                            {task && onDelete && showDone && (
                                <button type="button" onClick={() => { onDelete(task.id); onClose(); }} className="px-6 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition-all">
                                    <Trash2 size={20} />
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    // UPDATES / REPORTING TAB
                    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900/50">

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                            {(!formData.updates || formData.updates.length === 0) ? (
                                <div className="text-center text-gray-400 py-10 flex flex-col items-center">
                                    <Activity size={48} className="mb-4 opacity-30" />
                                    <p className="font-bold text-lg text-gray-500">هنوز گزارشی ثبت نشده است.</p>
                                    <p className="text-sm mt-2">شروع به نوشتن گزارش یا پیگیری کنید.</p>
                                </div>
                            ) : (
                                formData.updates.map((update, idx) => {
                                    const user = users.find(u => u.id === update.userId) || currentUser;
                                    const isReporter = user.id === formData.assigneeId;

                                    return (
                                        <div key={update.id} className={`flex gap-4 ${isReporter ? '' : 'flex-row-reverse'}`}>
                                            <div className="flex flex-col items-center gap-1">
                                                <img src={user.avatar} className="w-12 h-12 rounded-2xl border-2 border-white dark:border-gray-800 shadow-sm z-10" alt="" />
                                                {idx < (formData.updates?.length || 0) - 1 && (
                                                    <div className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700 my-1"></div>
                                                )}
                                            </div>

                                            <div className={`flex-1 max-w-[85%] ${isReporter ? '' : 'text-right'}`}>
                                                <div className={`bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm border ${isReporter ? 'rounded-tl-none border-blue-100 dark:border-blue-900/20' : 'rounded-tr-none border-orange-100 dark:border-orange-900/20'}`}>
                                                    <div className={`flex items-center gap-2 mb-2 ${isReporter ? '' : 'flex-row-reverse'}`}>
                                                        <span className="font-black text-sm text-gray-900 dark:text-white">{user.name}</span>
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isReporter ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                                                         {isReporter ? 'مسئول پروژه' : 'پیگیری / مدیریت'}
                                                     </span>
                                                        <span className="text-[10px] text-gray-400 ml-auto">{new Date(update.timestamp).toLocaleDateString('fa-IR')} - {new Date(update.timestamp).toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'})}</span>
                                                    </div>

                                                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-7 whitespace-pre-wrap">{update.content}</p>

                                                    {/* Attachment Display */}
                                                    {update.attachment && (
                                                        <div className="mt-4">
                                                            {update.attachmentType === 'image' ? (
                                                                <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                                                                    <img src={update.attachment} alt="attachment" className="max-h-60 w-full object-cover" />
                                                                </div>
                                                            ) : (
                                                                <a href={update.attachment} download={update.attachmentName || 'file'} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 transition-colors group">
                                                                    <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg text-blue-600 dark:text-blue-400">
                                                                        <FileText size={20} />
                                                                    </div>
                                                                    <div className="flex-1 overflow-hidden">
                                                                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{update.attachmentName || 'فایل ضمیمه'}</p>
                                                                        <span className="text-[10px] text-blue-500 font-bold flex items-center gap-1 group-hover:underline">
                                                                         <Download size={10} /> دانلود فایل
                                                                     </span>
                                                                    </div>
                                                                </a>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Progress Snapshot (Visible if it was recorded > 0) */}
                                                    {update.progressValue !== undefined && update.progressValue > 0 && (
                                                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50 flex items-center gap-2">
                                                            <span className="text-[10px] text-gray-400 font-bold">پیشرفت:</span>
                                                            <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                                <div className="h-full bg-green-500 rounded-full" style={{width: `${update.progressValue}%`}}></div>
                                                            </div>
                                                            <span className="text-[10px] font-bold text-green-600">{update.progressValue}%</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={updatesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
                            {/* Progress Slider (Only for Assignee) */}
                            {isAssignee && (
                                <div className="px-2 mb-3">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">درصد پیشرفت کار خود را اعلام کنید:</span>
                                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{manualProgress}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="5"
                                        value={manualProgress}
                                        onChange={(e) => setManualProgress(Number(e.target.value))}
                                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                </div>
                            )}

                            <div className="relative bg-gray-50 dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-700 p-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 transition-shadow">
                             <textarea
                                 value={updateText}
                                 onChange={e => setUpdateText(e.target.value)}
                                 className="w-full bg-transparent outline-none text-sm min-h-[60px] resize-none dark:text-white p-2"
                                 placeholder={isAssignee ? "توضیحات گزارش خود را بنویسید..." : "پیام پیگیری یا بازخورد خود را بنویسید..."}
                             />

                                {updateAttachment && (
                                    <div className="mx-2 mb-2 p-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            {updateAttachmentType === 'image' ? <ImageIcon size={16} className="text-purple-500"/> : <FileText size={16} className="text-orange-500"/>}
                                            <span className="text-xs truncate font-bold text-gray-700 dark:text-gray-300 max-w-[150px]">{updateAttachmentName}</span>
                                        </div>
                                        <button onClick={() => { setUpdateAttachment(null); setUpdateAttachmentName(''); }} className="text-red-500 p-1 hover:bg-red-50 rounded-full"><X size={14}/></button>
                                    </div>
                                )}

                                <div className="flex justify-between items-center px-2 pb-1">
                                    <div className="flex gap-1">
                                        <label className="cursor-pointer p-2 hover:bg-white dark:hover:bg-gray-800 rounded-full text-gray-500 hover:text-purple-500 transition-colors" title="پیوست تصویر">
                                            <ImageIcon size={18} />
                                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpdateFileSelect(e, 'image')} />
                                        </label>
                                        <label className="cursor-pointer p-2 hover:bg-white dark:hover:bg-gray-800 rounded-full text-gray-500 hover:text-orange-500 transition-colors" title="پیوست فایل">
                                            <Paperclip size={18} />
                                            <input type="file" className="hidden" onChange={(e) => handleUpdateFileSelect(e, 'file')} />
                                        </label>
                                    </div>
                                    <button onClick={handleAddUpdate} disabled={!updateText.trim() && !updateAttachment} className="bg-blue-600 disabled:bg-gray-300 text-white px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30">
                                        <Send size={16} className={updateText ? "ml-1" : ""} />
                                        {isAssignee ? 'ارسال گزارش' : 'ارسال پیام'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TaskModal;
