import React, {useState, useEffect} from 'react';
import {CalendarEvent, User, Task, Alarm, EventTodo, RichBlock} from '../types';
import {
    gregorianToJalali,
    jalaliMonthNames,
    isHoliday,
    getHolidayName,
    getJalaliDaysInMonth,
    getDayOfWeekJalali,
    getLunarDate,
    lunarMonthNames,
    jalaliToGregorian
} from '../utils/dateUtils';
import {
    ChevronLeft,
    ChevronRight,
    MapPin,
    Users,
    Link as LinkIcon,
    Lock,
    Globe,
    FileText,
    X,
    Save,
    Clock,
    Bell,
    BellRing,
    Calendar as CalendarIcon,
    CheckSquare,
    List,
    StickyNote,
    Plus,
    Trash2,
    ArrowRight,
    Edit2
} from 'lucide-react';
import {MockBackend, generateUUID} from '../services/mockBackend';
import RichContentBlock from './RichContentBlock';

interface JalaliCalendarProps {
    currentUser: User;
    users: User[];
}

type ViewMode = 'LIST' | 'FORM';

const JalaliCalendar: React.FC<JalaliCalendarProps> = ({currentUser, users}) => {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);

    const now = new Date();
    const [currentJalali, setCurrentJalali] = useState(() => {
        const [y, m, d] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
        return {jy: y, jm: m, jd: d};
    });

    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [hoveredDay, setHoveredDay] = useState<number | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('LIST');
    const [eventForm, setEventForm] = useState<Partial<CalendarEvent>>({});
    const [activeTab, setActiveTab] = useState<'details' | 'todo' | 'notes'>('details');
    const [newAlarmOffset, setNewAlarmOffset] = useState<number>(15);
    const [newTodoTitle, setNewTodoTitle] = useState('');

    const {jy, jm, jd: todayJd} = currentJalali;
    const [realJy, realJm, realJd] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());

    useEffect(() => {
        const loadData = async () => {
            const loadedEvents = await MockBackend.getEvents(currentUser.id, currentUser.role);
            const loadedTasks = await MockBackend.getTasks();
            setEvents(loadedEvents);
            setTasks(loadedTasks.filter(t => t.status !== 'DONE'));
        };
        loadData();
    }, [currentUser, jy, jm]);

    const daysInMonth = getJalaliDaysInMonth(jy, jm);
    const days = Array.from({length: daysInMonth}, (_, i) => i + 1);
    const startDayOffset = getDayOfWeekJalali(jy, jm, 1);
    const blanks = Array.from({length: startDayOffset}, (_, i) => i);
    const weekDays = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];

    const handlePrevMonth = () => {
        if (jm === 1) {
            setCurrentJalali({...currentJalali, jy: jy - 1, jm: 12});
        } else {
            setCurrentJalali({...currentJalali, jm: jm - 1});
        }
    };

    const handleNextMonth = () => {
        if (jm === 12) {
            setCurrentJalali({...currentJalali, jy: jy + 1, jm: 1});
        } else {
            setCurrentJalali({...currentJalali, jm: jm + 1});
        }
    };

    const goToToday = () => {
        setCurrentJalali({jy: realJy, jm: realJm, jd: realJd});
    };

    // Filter events for a specific day
    const getDayEvents = (day: number) => events.filter(e => {
        if (!e.startTime) return false;
        const d = new Date(e.startTime);
        if (isNaN(d.getTime())) return false;
        const [ejy, ejm, ejd] = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
        return ejy === jy && ejm === jm && ejd === day;
    });

    const getDayTasks = (day: number) => tasks.filter(t => {
        const d = new Date(t.dueDate);
        const [tj, tm, td] = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
        return tj === jy && tm === jm && td === day;
    });

    const handleDayClick = (day: number) => {
        setSelectedDay(day);
        setViewMode('LIST'); // Always open in List view first
        setIsModalOpen(true);
    };

    const initNewEvent = () => {
        setEventForm({
            startTime: '08:00',
            endTime: '09:00',
            isPublic: false,
            color: '#3B82F6',
            alarms: [],
            eventTodos: [],
            richNotes: []
        });
        setActiveTab('details');
        setViewMode('FORM');
    };

    const editEvent = (ev: CalendarEvent) => {
        // Convert ISO back to HH:MM for input
        const start = new Date(ev.startTime);
        const end = new Date(ev.endTime);
        const toTime = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

        setEventForm({
            ...ev,
            startTime: toTime(start),
            endTime: toTime(end)
        });
        setActiveTab('details');
        setViewMode('FORM');
    };

    const handleDeleteEvent = async (eventId: string) => {
        if (!window.confirm("آیا از حذف این رویداد اطمینان دارید؟")) return;

        try {
            await MockBackend.deleteEvent(eventId);
            const updatedEvents = events.filter(e => e.id !== eventId);
            setEvents(updatedEvents);
            setViewMode('LIST');
        } catch (error) {
            console.error("Failed to delete event", error);
            alert("خطا در حذف رویداد. لطفاً مجدد تلاش کنید.");
        }
    };

    const handleAddAlarm = () => {
        const currentAlarms = eventForm.alarms || [];
        const newAlarm: Alarm = {id: generateUUID(), offsetMinutes: newAlarmOffset, isFired: false};
        setEventForm({...eventForm, alarms: [...currentAlarms, newAlarm]});
    };
    const handleRemoveAlarm = (alarmId: string) => {
        const currentAlarms = eventForm.alarms || [];
        setEventForm({...eventForm, alarms: currentAlarms.filter(a => a.id !== alarmId)});
    };

    const handleAddTodo = () => {
        if (!newTodoTitle.trim()) return;
        const currentTodos = eventForm.eventTodos || [];
        const newTodo: EventTodo = {id: generateUUID(), title: newTodoTitle, isCompleted: false};
        setEventForm({...eventForm, eventTodos: [...currentTodos, newTodo]});
        setNewTodoTitle('');
    };
    const toggleTodo = (id: string) => {
        const currentTodos = eventForm.eventTodos || [];
        setEventForm({
            ...eventForm,
            eventTodos: currentTodos.map(t => t.id === id ? {...t, isCompleted: !t.isCompleted} : t)
        });
    };
    const deleteTodo = (id: string) => {
        const currentTodos = eventForm.eventTodos || [];
        setEventForm({...eventForm, eventTodos: currentTodos.filter(t => t.id !== id)});
    };

    const handleSaveEvent = async () => {
        if (!eventForm.title || !selectedDay) return;

        const [gy, gm, gd] = jalaliToGregorian(jy, jm, selectedDay);
        const startParts = (eventForm.startTime || '08:00').split(':').map(Number);
        const endParts = (eventForm.endTime || '09:00').split(':').map(Number);

        const startDate = new Date(gy, gm - 1, gd, startParts[0], startParts[1]);
        const endDate = new Date(gy, gm - 1, gd, endParts[0], endParts[1]);

        const newEvent: CalendarEvent = {
            id: eventForm.id || generateUUID(),
            title: eventForm.title,
            description: eventForm.description || '',
            isPublic: eventForm.isPublic || false,
            ownerId: currentUser.id,
            startTime: startDate.toISOString(),
            endTime: endDate.toISOString(),
            location: eventForm.location,
            link: eventForm.link,
            attendees: eventForm.attendees || [],
            color: eventForm.color || '#3B82F6',
            alarms: eventForm.alarms || [],
            eventTodos: eventForm.eventTodos || [],
            richNotes: eventForm.richNotes || []
        };

        await MockBackend.saveEvent(newEvent);
        const loaded = await MockBackend.getEvents(currentUser.id, currentUser.role);
        setEvents(loaded);

        // Go back to list view to see the new item
        setViewMode('LIST');
    };

    const eventColors = ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#007AFF', '#AF52DE', '#8E8E93'];

    // Helper for rendering
    const selectedDayEvents = selectedDay ? getDayEvents(selectedDay) : [];
    const selectedDayTasks = selectedDay ? getDayTasks(selectedDay) : [];

    return (
        <div className="h-full flex gap-6">
            <div
                className="flex-1 bg-white/90 dark:bg-gray-800/90 backdrop-blur-3xl rounded-[2.5rem] p-8 shadow-2xl shadow-blue-900/10 border border-white/80 dark:border-gray-700 flex flex-col relative overflow-visible">
                <div className="flex justify-between items-center mb-8 px-2 z-10">
                    <div className="flex flex-col">
                        <span
                            className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-widest">تقویم جلالی / قمری</span>
                        <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter flex items-baseline gap-2">
                            {jalaliMonthNames[jm - 1]} <span className="text-gray-400 font-light text-2xl">{jy}</span>
                        </h2>
                    </div>
                    <div className="flex items-center gap-4">
                        {(jm !== realJm || jy !== realJy) && (
                            <button onClick={goToToday}
                                    className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-4 py-2 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all">
                                امروز
                            </button>
                        )}
                        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-2xl p-1 shadow-inner">
                            <button onClick={handleNextMonth}
                                    className="p-3 hover:bg-white dark:hover:bg-gray-600 rounded-xl transition-all text-gray-700 dark:text-gray-200 shadow-sm active:scale-95">
                                <ChevronRight size={20}/></button>
                            <div className="w-px bg-gray-300 dark:bg-gray-600 my-2 mx-1"></div>
                            <button onClick={handlePrevMonth}
                                    className="p-3 hover:bg-white dark:hover:bg-gray-600 rounded-xl transition-all text-gray-700 dark:text-gray-200 shadow-sm active:scale-95">
                                <ChevronLeft size={20}/></button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-7 mb-4 px-2">
                    {weekDays.map(d => (
                        <div key={d}
                             className={`text-right pr-3 font-bold text-xs uppercase tracking-wide ${d === 'جمعه' ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
                            {d}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 flex-1 auto-rows-fr gap-2 z-10">
                    {blanks.map(b => <div key={`b-${b}`} className=""/>)}
                    {days.map((day, index) => {
                        const dayEvents = getDayEvents(day);
                        const dayTasks = getDayTasks(day);
                        const isToday = day === realJd && jm === realJm && jy === realJy;
                        const dayOfWeekIndex = (startDayOffset + index) % 7;
                        const isOff = isHoliday(jy, jm, day, dayOfWeekIndex);
                        const holidayName = getHolidayName(jy, jm, day, dayOfWeekIndex);
                        const hasItems = dayEvents.length > 0 || dayTasks.length > 0;
                        const isHovered = hoveredDay === day;

                        const [ly, lm, ld] = getLunarDate(jy, jm, day);

                        return (
                            <div
                                key={day}
                                onClick={() => handleDayClick(day)}
                                onMouseEnter={() => setHoveredDay(day)}
                                onMouseLeave={() => setHoveredDay(null)}
                                className={`
                                rounded-3xl p-3 flex flex-col items-start justify-between min-h-[100px] relative group transition-all duration-200 cursor-pointer
                                ${isToday ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' :
                                    isOff ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400' :
                                        'bg-gray-50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-700 hover:shadow-md text-gray-700 dark:text-gray-300'}
                            `}
                            >
                                <div className="flex justify-between w-full items-start">
                                    <span className={`text-lg font-bold ${isToday ? 'text-white' : ''}`}>{day}</span>
                                    <span
                                        className={`text-[10px] font-medium ${isToday ? 'text-white/80' : 'text-gray-400 dark:text-gray-500'}`}>
                                    {ld} {lunarMonthNames[lm - 1] || ''}
                                </span>
                                </div>

                                {isOff && !isToday && <span
                                    className="text-[9px] font-bold opacity-70 truncate max-w-full mt-1 block">{holidayName}</span>}

                                <div className="w-full flex flex-wrap content-end gap-1 px-0.5 mb-1 mt-auto">
                                    {dayEvents.slice(0, 3).map(ev => (
                                        <div key={ev.id}
                                             className={`w-1.5 h-1.5 rounded-full ${isToday ? 'border border-white' : ''}`}
                                             style={{backgroundColor: ev.color}}/>
                                    ))}
                                    {dayEvents.length > 3 && <span className="text-[8px] opacity-50">+</span>}
                                    {dayTasks.slice(0, 2).map(t => (
                                        <div key={t.id}
                                             className={`w-1.5 h-1.5 rounded-full border box-border ${isToday ? 'border-white/70' : 'border-gray-400 dark:border-gray-500'}`}/>
                                    ))}
                                </div>

                                {/* HOVER POPUP SUMMARY */}
                                {isHovered && hasItems && (
                                    <div
                                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-48 pointer-events-none animate-in fade-in zoom-in-95 duration-200">
                                        <div
                                            className="bg-white/80 dark:bg-gray-800/90 backdrop-blur-xl p-3 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] border border-white/50 dark:border-gray-600 text-right">

                                            {/* Events Section */}
                                            {dayEvents.length > 0 && (
                                                <div className="mb-2">
                                                    <span
                                                        className="text-[9px] font-bold text-gray-400 uppercase mb-1 block">رویدادها</span>
                                                    <div className="space-y-1">
                                                        {dayEvents.slice(0, 2).map(e => (
                                                            <div key={e.id} className="flex items-center gap-1.5">
                                                                <div className="w-1.5 h-1.5 rounded-full shrink-0"
                                                                     style={{backgroundColor: e.color}}></div>
                                                                <span
                                                                    className="text-[10px] font-bold text-gray-800 dark:text-gray-200 truncate">{e.title}</span>
                                                            </div>
                                                        ))}
                                                        {dayEvents.length > 2 && <span
                                                            className="text-[9px] text-blue-500 font-bold">+{dayEvents.length - 2} مورد دیگر</span>}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Tasks Section */}
                                            {dayTasks.length > 0 && (
                                                <div
                                                    className={dayEvents.length > 0 ? "pt-2 border-t border-gray-200/50 dark:border-gray-700/50" : ""}>
                                                    <span
                                                        className="text-[9px] font-bold text-gray-400 uppercase mb-1 block">تسک‌ها</span>
                                                    <div className="space-y-1">
                                                        {dayTasks.slice(0, 2).map(t => (
                                                            <div key={t.id} className="flex items-center gap-1.5">
                                                                <div
                                                                    className={`w-1.5 h-1.5 rounded-sm shrink-0 border ${t.status === 'DONE' ? 'bg-green-500 border-green-500' : 'border-gray-400'}`}></div>
                                                                <span
                                                                    className={`text-[10px] font-bold truncate ${t.status === 'DONE' ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-300'}`}>{t.title}</span>
                                                            </div>
                                                        ))}
                                                        {dayTasks.length > 2 && <span
                                                            className="text-[9px] text-blue-500 font-bold">+{dayTasks.length - 2} مورد دیگر</span>}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Tail */}
                                            <div
                                                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white/80 dark:bg-gray-800/90 rotate-45"></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {isModalOpen && (
                <div
                    className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/20 backdrop-blur-sm transition-all">
                    <div
                        className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.4)] w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-white/50 dark:border-gray-600 flex flex-col max-h-[90vh]">

                        {/* MODAL HEADER */}
                        <div
                            className="p-6 border-b border-gray-100/50 dark:border-gray-700/50 flex justify-between items-center bg-white/40 dark:bg-gray-800/40">
                            <div className="flex items-center gap-3">
                                {viewMode === 'FORM' && (
                                    <button onClick={() => setViewMode('LIST')}
                                            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                        <ArrowRight size={20} className="text-gray-600 dark:text-gray-300"/>
                                    </button>
                                )}
                                <h3 className="font-bold text-xl text-gray-900 dark:text-white">
                                    {viewMode === 'LIST' ? `برنامه ${selectedDay} ${jalaliMonthNames[jm - 1]}` : (eventForm.id ? 'ویرایش رویداد' : 'افزودن رویداد جدید')}
                                </h3>
                            </div>
                            <button onClick={() => setIsModalOpen(false)}
                                    className="bg-gray-100 dark:bg-gray-700 p-2 rounded-full hover:bg-red-50 hover:text-red-500 shadow-sm transition-colors">
                                <X size={20}/></button>
                        </div>

                        {/* VIEW MODE: LIST */}
                        {viewMode === 'LIST' && (
                            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar flex flex-col">
                                {selectedDayEvents.length === 0 && selectedDayTasks.length === 0 ? (
                                    <div
                                        className="flex-1 flex flex-col items-center justify-center text-gray-400 py-12">
                                        <CalendarIcon size={48} className="mb-4 opacity-20"/>
                                        <p className="text-sm font-medium">هیچ رویدادی برای این روز ثبت نشده است.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {selectedDayEvents.length > 0 && (
                                            <div>
                                                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                                    رویدادها
                                                </h4>
                                                <div className="space-y-3">
                                                    {selectedDayEvents.map(ev => (
                                                        <div key={ev.id} onClick={() => editEvent(ev)}
                                                             className="group bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 cursor-pointer transition-all shadow-sm flex items-center gap-4 relative overflow-hidden">
                                                            <div className="w-1 absolute right-0 top-0 bottom-0"
                                                                 style={{backgroundColor: ev.color}}></div>
                                                            <div className="flex-1">
                                                                <h5 className="font-bold text-gray-800 dark:text-white mb-1">{ev.title}</h5>
                                                                <div
                                                                    className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                                                               <span
                                                                   className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md">
                                                                   <Clock size={12}/>
                                                                   {new Date(ev.startTime).toLocaleTimeString('fa-IR', {
                                                                       hour: '2-digit',
                                                                       minute: '2-digit'
                                                                   })} - {new Date(ev.endTime).toLocaleTimeString('fa-IR', {
                                                                   hour: '2-digit',
                                                                   minute: '2-digit'
                                                               })}
                                                               </span>
                                                                    {ev.location && <span
                                                                        className="flex items-center gap-1"><MapPin
                                                                        size={12}/> {ev.location}</span>}
                                                                </div>
                                                            </div>
                                                            <div
                                                                className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                                                <button
                                                                    className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                                                                    <Edit2 size={16}/></button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteEvent(ev.id);
                                                                    }}
                                                                    className="p-2 bg-red-50 text-red-600 rounded-xl"
                                                                >
                                                                    <Trash2 size={16}/>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {selectedDayTasks.length > 0 && (
                                            <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                                                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                                                    تسک‌ها (جهت یادآوری)
                                                </h4>
                                                <div className="space-y-2 opacity-80">
                                                    {selectedDayTasks.map(t => (
                                                        <div key={t.id}
                                                             className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-transparent">
                                                            <div
                                                                className="w-4 h-4 rounded border-2 border-gray-400 dark:border-gray-600"></div>
                                                            <span
                                                                className="text-sm font-medium text-gray-700 dark:text-gray-300 line-through decoration-gray-400/50 decoration-2">{t.title}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="mt-auto pt-6">
                                    <button onClick={initNewEvent}
                                            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform">
                                        <Plus size={20}/>
                                        افزودن رویداد جدید
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* VIEW MODE: FORM */}
                        {viewMode === 'FORM' && (
                            <>
                                <div
                                    className="flex px-6 border-b border-gray-100 dark:border-gray-700 space-x-6 space-x-reverse bg-white dark:bg-gray-900">
                                    <button onClick={() => setActiveTab('details')}
                                            className={`py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'details' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                        <CalendarIcon size={16}/> جزئیات
                                    </button>
                                    <button onClick={() => setActiveTab('todo')}
                                            className={`py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'todo' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                        <List size={16}/> لیست کارها
                                    </button>
                                    <button onClick={() => setActiveTab('notes')}
                                            className={`py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'notes' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                        <StickyNote size={16}/> صورت‌جلسه
                                    </button>
                                </div>

                                <div
                                    className="p-8 overflow-y-auto custom-scrollbar flex-1 bg-gray-50/50 dark:bg-gray-900/50">

                                    {/* DETAILS TAB */}
                                    {activeTab === 'details' && (
                                        <div className="space-y-5">
                                            <input
                                                className="w-full p-4 bg-white dark:bg-gray-900 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold text-lg text-gray-900 dark:text-white placeholder-gray-400 transition-all border border-gray-200 dark:border-gray-700 focus:border-blue-300 shadow-sm"
                                                placeholder="عنوان رویداد..."
                                                value={eventForm.title || ''}
                                                onChange={e => setEventForm({...eventForm, title: e.target.value})}
                                            />

                                            <div className="grid grid-cols-2 gap-4">
                                                <div
                                                    className="bg-white dark:bg-gray-900 p-3 rounded-2xl flex items-center gap-2 border border-gray-200 dark:border-gray-700 shadow-sm">
                                                    <Clock size={18} className="text-blue-500"/>
                                                    <input type="time"
                                                           className="bg-transparent outline-none w-full font-bold text-gray-700 dark:text-gray-300 text-sm"
                                                           value={eventForm.startTime} onChange={e => setEventForm({
                                                        ...eventForm,
                                                        startTime: e.target.value
                                                    })}/>
                                                </div>
                                                <div
                                                    className="bg-white dark:bg-gray-900 p-3 rounded-2xl flex items-center gap-2 border border-gray-200 dark:border-gray-700 shadow-sm">
                                                    <Clock size={18} className="text-gray-400"/>
                                                    <input type="time"
                                                           className="bg-transparent outline-none w-full font-bold text-gray-700 dark:text-gray-300 text-sm"
                                                           value={eventForm.endTime} onChange={e => setEventForm({
                                                        ...eventForm,
                                                        endTime: e.target.value
                                                    })}/>
                                                </div>
                                            </div>

                                            <div
                                                className="bg-orange-50/50 dark:bg-orange-900/20 p-4 rounded-2xl border border-orange-100/50 dark:border-orange-800/30">
                                                <label
                                                    className="flex items-center gap-2 text-orange-600 dark:text-orange-400 text-xs font-bold mb-3 uppercase"><Bell
                                                    size={14}/> تنظیم آلارم</label>

                                                <div className="flex gap-2 mb-3">
                                                    <select
                                                        value={newAlarmOffset}
                                                        onChange={(e) => setNewAlarmOffset(Number(e.target.value))}
                                                        className="bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 text-sm p-2 rounded-xl flex-1 outline-none border border-gray-200 dark:border-gray-700"
                                                    >
                                                        <option value={0}>همان لحظه</option>
                                                        <option value={15}>۱۵ دقیقه قبل</option>
                                                        <option value={30}>۳۰ دقیقه قبل</option>
                                                        <option value={60}>۱ ساعت قبل</option>
                                                        <option value={1440}>۱ روز قبل</option>
                                                    </select>
                                                    <button onClick={handleAddAlarm}
                                                            className="bg-orange-100 dark:bg-orange-800 text-orange-600 dark:text-orange-200 px-4 rounded-xl text-xs font-bold hover:bg-orange-200 transition-colors">افزودن
                                                    </button>
                                                </div>

                                                <div className="flex flex-wrap gap-2">
                                                    {eventForm.alarms?.map((alarm, idx) => (
                                                        <div key={idx}
                                                             className="bg-white dark:bg-gray-900 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 shadow-sm">
                                                            <BellRing size={12} className="text-orange-500"/>
                                                            {alarm.offsetMinutes === 0 ? 'همان لحظه' :
                                                                alarm.offsetMinutes === 1440 ? '۱ روز قبل' :
                                                                    alarm.offsetMinutes === 60 ? '۱ ساعت قبل' :
                                                                        `${alarm.offsetMinutes} دقیقه قبل`}
                                                            <button onClick={() => handleRemoveAlarm(alarm.id)}
                                                                    className="hover:text-red-500"><X size={12}/>
                                                            </button>
                                                        </div>
                                                    ))}
                                                    {(!eventForm.alarms || eventForm.alarms.length === 0) && <span
                                                        className="text-xs text-gray-400 italic">بدون آلارم</span>}
                                                </div>
                                            </div>

                                            <div
                                                className="bg-white dark:bg-gray-900 p-3 rounded-2xl flex items-center gap-2 border border-gray-200 dark:border-gray-700 shadow-sm">
                                                <MapPin size={20} className="text-gray-400"/>
                                                <input
                                                    className="bg-transparent outline-none w-full text-sm font-medium text-gray-700 dark:text-gray-300"
                                                    placeholder="محل برگزاری (لینک یا آدرس)..."
                                                    value={eventForm.location || ''}
                                                    onChange={e => setEventForm({
                                                        ...eventForm,
                                                        location: e.target.value
                                                    })}
                                                />
                                            </div>

                                            <textarea
                                                className="w-full p-4 bg-white dark:bg-gray-900 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 min-h-[100px] text-sm resize-none border border-gray-200 dark:border-gray-700 shadow-sm text-gray-700 dark:text-gray-300"
                                                placeholder="توضیحات کوتاه..."
                                                value={eventForm.description || ''}
                                                onChange={e => setEventForm({
                                                    ...eventForm,
                                                    description: e.target.value
                                                })}
                                            />

                                            <div
                                                className="flex gap-3 justify-center py-2 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                                                {eventColors.map(c => (
                                                    <button
                                                        key={c}
                                                        onClick={() => setEventForm({...eventForm, color: c})}
                                                        className={`w-6 h-6 rounded-full transition-transform hover:scale-125 ${eventForm.color === c ? 'ring-2 ring-offset-2 ring-gray-300 scale-125' : ''}`}
                                                        style={{backgroundColor: c}}
                                                    />
                                                ))}
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div
                                                    className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${eventForm.isPublic ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}
                                                    onClick={() => setEventForm({
                                                        ...eventForm,
                                                        isPublic: !eventForm.isPublic
                                                    })}
                                                >
                                                    {eventForm.isPublic ? <Globe size={18}
                                                                                 className="text-green-600 dark:text-green-400"/> :
                                                        <Lock size={18} className="text-gray-400"/>}
                                                    <span
                                                        className="text-xs font-bold text-gray-700 dark:text-gray-300">{eventForm.isPublic ? 'عمومی' : 'خصوصی'}</span>
                                                </div>
                                                <div
                                                    className="p-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center gap-2 text-gray-400 text-xs font-bold cursor-not-allowed">
                                                    <Users size={18}/>
                                                    <span>{eventForm.attendees?.length || 0} شرکت‌کننده</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* TODO TAB */}
                                    {activeTab === 'todo' && (
                                        <div className="space-y-4">
                                            <p className="text-xs text-gray-500 mb-2">لیست کارهایی که باید در این رویداد
                                                انجام شوند:</p>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={newTodoTitle}
                                                    onChange={e => setNewTodoTitle(e.target.value)}
                                                    placeholder="افزودن کار جدید..."
                                                    className="flex-1 bg-white dark:bg-gray-900 text-sm px-4 py-3 rounded-xl outline-none border border-gray-200 dark:border-gray-700"
                                                    onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), handleAddTodo())}
                                                />
                                                <button onClick={handleAddTodo}
                                                        className="bg-blue-500 text-white p-3 rounded-xl hover:bg-blue-600">
                                                    <CheckSquare size={20}/></button>
                                            </div>
                                            <div className="space-y-2">
                                                {eventForm.eventTodos?.map(todo => (
                                                    <div key={todo.id}
                                                         className="flex items-center gap-3 bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                                                        <div onClick={() => toggleTodo(todo.id)}
                                                             className={`w-5 h-5 rounded-md border flex items-center justify-center cursor-pointer ${todo.isCompleted ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                                                            {todo.isCompleted &&
                                                                <X className="rotate-45 text-white" size={14}/>}
                                                        </div>
                                                        <span
                                                            className={`flex-1 text-sm font-medium ${todo.isCompleted ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-gray-200'}`}>{todo.title}</span>
                                                        <button onClick={() => deleteTodo(todo.id)}
                                                                className="text-red-400 hover:text-red-600"><X
                                                            size={16}/></button>
                                                    </div>
                                                ))}
                                                {(!eventForm.eventTodos || eventForm.eventTodos.length === 0) &&
                                                    <p className="text-center text-gray-400 text-xs italic py-4">موردی
                                                        یافت نشد.</p>}
                                            </div>
                                        </div>
                                    )}

                                    {/* NOTES TAB */}
                                    {activeTab === 'notes' && (
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <StickyNote size={16} className="text-purple-500"/>
                                                <span className="text-xs font-bold text-gray-600 dark:text-gray-400">یادداشت‌های جلسه / صورت‌جلسه</span>
                                            </div>
                                            <RichContentBlock
                                                blocks={eventForm.richNotes || []}
                                                onChange={(blocks) => setEventForm({...eventForm, richNotes: blocks})}
                                            />
                                        </div>
                                    )}

                                </div>

                                <div
                                    className="p-6 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900">
                                    <button onClick={handleSaveEvent}
                                            className="w-full bg-[#007AFF] hover:bg-[#0062CC] text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-500/30 flex justify-center items-center gap-2 transition-transform hover:scale-[1.02] active:scale-95 text-lg">
                                        <Save/>
                                        {eventForm.id ? 'بروزرسانی رویداد' : 'ثبت رویداد'}
                                    </button>
                                </div>
                            </>
                        )}

                    </div>
                </div>
            )}
        </div>
    );
};

export default JalaliCalendar;
