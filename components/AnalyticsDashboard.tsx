import React, { useMemo } from 'react';
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
    BarChart,
    Bar,
    CartesianGrid,
    XAxis,
    YAxis,
    AreaChart,
    Area,
    Legend
} from 'recharts';
import { Priority, Task, TaskStatus, User } from '../types';
import { BarChart3, Activity, Bell, Sparkles } from 'lucide-react';

interface AnalyticsDashboardProps {
    tasks: Task[];
    users: User[];
}

const STATUS_META: Record<TaskStatus, { label: string; color: string }> = {
    [TaskStatus.TODO]: { label: 'برای انجام', color: '#60a5fa' },
    [TaskStatus.IN_PROGRESS]: { label: 'در حال انجام', color: '#a78bfa' },
    [TaskStatus.IN_REVIEW]: { label: 'در انتظار بررسی', color: '#f59e0b' },
    [TaskStatus.DONE]: { label: 'تکمیل شده', color: '#22c55e' }
};

const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
    [Priority.LOW]: { label: 'پایین', color: '#38bdf8' },
    [Priority.MEDIUM]: { label: 'متوسط', color: '#6366f1' },
    [Priority.HIGH]: { label: 'بالا', color: '#f97316' },
    [Priority.CRITICAL]: { label: 'بحرانی', color: '#ef4444' }
};

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ tasks, users }) => {
    const statusData = useMemo(() => {
        return (Object.values(TaskStatus) as TaskStatus[]).map((status) => ({
            key: status,
            name: STATUS_META[status].label,
            value: tasks.filter(task => task.status === status).length,
            color: STATUS_META[status].color
        }));
    }, [tasks]);

    const priorityData = useMemo(() => {
        return (Object.values(Priority) as Priority[]).map((priority) => ({
            key: priority,
            name: PRIORITY_META[priority].label,
            value: tasks.filter(task => task.priority === priority).length,
            color: PRIORITY_META[priority].color
        }));
    }, [tasks]);

    const workloadData = useMemo(() => {
        return users.map((user) => {
            const assigned = tasks.filter(task => task.assigneeId === user.id);
            const completed = assigned.filter(task => task.status === TaskStatus.DONE).length;
            return {
                name: user.name,
                assigned: assigned.length,
                done: completed,
                inProgress: assigned.filter(task => task.status === TaskStatus.IN_PROGRESS).length
            };
        }).sort((a, b) => b.assigned - a.assigned).slice(0, 8);
    }, [tasks, users]);

    const dueTrendData = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return Array.from({ length: 7 }).map((_, index) => {
            const day = new Date(today);
            day.setDate(today.getDate() + index);
            const dayStart = day.getTime();
            const dayEnd = dayStart + (24 * 60 * 60 * 1000);

            const dueCount = tasks.filter(task => {
                const due = new Date(task.dueDate).getTime();
                return due >= dayStart && due < dayEnd;
            }).length;

            const doneCount = tasks.filter(task => {
                const due = new Date(task.dueDate).getTime();
                return due >= dayStart && due < dayEnd && task.status === TaskStatus.DONE;
            }).length;

            return {
                day: day.toLocaleDateString('fa-IR', { weekday: 'short' }),
                due: dueCount,
                done: doneCount
            };
        });
    }, [tasks]);

    const totalTasks = tasks.length;
    const doneTasks = tasks.filter(task => task.status === TaskStatus.DONE).length;
    const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    const overdueTasks = tasks.filter(task => {
        const dueDate = new Date(task.dueDate).getTime();
        return dueDate < Date.now() && task.status !== TaskStatus.DONE;
    }).length;

    const highRiskTasks = tasks.filter(task => task.priority === Priority.HIGH || task.priority === Priority.CRITICAL).length;

    return (
        <div className="space-y-8 pb-10">
            <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 rounded-[2rem] p-8 text-white shadow-xl shadow-indigo-500/30">
                <div className="flex items-center gap-3 mb-3">
                    <BarChart3 className="w-8 h-8" />
                    <h2 className="text-2xl md:text-3xl font-black">داشبورد تحلیلی تیم</h2>
                </div>
                <p className="opacity-90 text-sm md:text-base">
                    نمای فوری از وضعیت تحویل، ریسک‌ها و ظرفیت اعضای تیم برای تصمیم‌گیری سریع‌تر.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-white/80 dark:bg-gray-800/70 border border-white/70 dark:border-gray-700 backdrop-blur-xl rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500">نرخ تکمیل</span>
                        <Activity className="w-4 h-4 text-emerald-500" />
                    </div>
                    <p className="text-3xl font-black text-gray-800 dark:text-white">{completionRate}%</p>
                    <p className="text-xs text-gray-500 mt-1">{doneTasks} از {totalTasks} تسک تکمیل شده</p>
                </div>
                <div className="bg-white/80 dark:bg-gray-800/70 border border-white/70 dark:border-gray-700 backdrop-blur-xl rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500">تسک‌های معوق</span>
                        <Bell className="w-4 h-4 text-amber-500" />
                    </div>
                    <p className="text-3xl font-black text-gray-800 dark:text-white">{overdueTasks}</p>
                    <p className="text-xs text-gray-500 mt-1">نیازمند پیگیری فوری</p>
                </div>
                <div className="bg-white/80 dark:bg-gray-800/70 border border-white/70 dark:border-gray-700 backdrop-blur-xl rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500">اولویت بالا/بحرانی</span>
                        <Sparkles className="w-4 h-4 text-rose-500" />
                    </div>
                    <p className="text-3xl font-black text-gray-800 dark:text-white">{highRiskTasks}</p>
                    <p className="text-xs text-gray-500 mt-1">مناسب برای جلسه مدیریت ریسک</p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-white/80 dark:bg-gray-800/70 border border-white/70 dark:border-gray-700 backdrop-blur-xl rounded-2xl p-5 shadow-sm">
                    <h3 className="font-bold text-gray-800 dark:text-white mb-4">ترکیب وضعیت تسک‌ها</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={3}>
                                    {statusData.map((entry) => (
                                        <Cell key={entry.key} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => [`${value} تسک`, 'تعداد']} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white/80 dark:bg-gray-800/70 border border-white/70 dark:border-gray-700 backdrop-blur-xl rounded-2xl p-5 shadow-sm">
                    <h3 className="font-bold text-gray-800 dark:text-white mb-4">توزیع اولویت‌ها</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={priorityData}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                <XAxis dataKey="name" />
                                <YAxis allowDecimals={false} />
                                <Tooltip formatter={(value: number) => [`${value} تسک`, 'تعداد']} />
                                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                                    {priorityData.map((entry) => (
                                        <Cell key={entry.key} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-white/80 dark:bg-gray-800/70 border border-white/70 dark:border-gray-700 backdrop-blur-xl rounded-2xl p-5 shadow-sm">
                    <h3 className="font-bold text-gray-800 dark:text-white mb-4">روند سررسید ۷ روز آینده</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dueTrendData}>
                                <defs>
                                    <linearGradient id="colorDue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.5}/>
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                <XAxis dataKey="day" />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Area type="monotone" dataKey="due" stroke="#6366f1" fillOpacity={1} fill="url(#colorDue)" name="سررسید" />
                                <Area type="monotone" dataKey="done" stroke="#22c55e" fillOpacity={0} name="تکمیل‌شده" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white/80 dark:bg-gray-800/70 border border-white/70 dark:border-gray-700 backdrop-blur-xl rounded-2xl p-5 shadow-sm">
                    <h3 className="font-bold text-gray-800 dark:text-white mb-4">بار کاری اعضای تیم (Top 8)</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={workloadData} layout="vertical" margin={{ left: 24 }}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                <XAxis type="number" allowDecimals={false} />
                                <YAxis type="category" dataKey="name" width={90} />
                                <Tooltip formatter={(value: number) => `${value} تسک`} />
                                <Legend />
                                <Bar dataKey="assigned" name="کل تسک" fill="#60a5fa" radius={[0, 8, 8, 0]} />
                                <Bar dataKey="done" name="تکمیل‌شده" fill="#22c55e" radius={[0, 8, 8, 0]} />
                                <Bar dataKey="inProgress" name="در حال انجام" fill="#f59e0b" radius={[0, 8, 8, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
