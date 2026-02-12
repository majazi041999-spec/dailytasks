import React from 'react';
import {Task, Priority, User} from '../types';
import {Clock, CheckSquare, MoreHorizontal, Calendar, Tag} from 'lucide-react';
import {formatJalali} from '../utils/dateUtils';

interface TaskCardProps {
    task: Task;
    allUsers: User[];
    onClick: (task: Task) => void;
}

// React.memo prevents the card from re-rendering if its props (task) haven't changed.
// This significantly improves performance when the parent component polls for updates.
const TaskCard: React.FC<TaskCardProps> = React.memo(({task, allUsers, onClick}) => {
    const assignee = allUsers.find(u => u.id === task.assigneeId);

    const priorityConfig = {
        [Priority.LOW]: {
            bg: 'bg-blue-50 dark:bg-blue-900/20',
            text: 'text-blue-600 dark:text-blue-400',
            border: 'border-blue-100 dark:border-blue-900',
            dot: 'bg-blue-500'
        },
        [Priority.MEDIUM]: {
            bg: 'bg-orange-50 dark:bg-orange-900/20',
            text: 'text-orange-600 dark:text-orange-400',
            border: 'border-orange-100 dark:border-orange-900',
            dot: 'bg-orange-500'
        },
        [Priority.HIGH]: {
            bg: 'bg-red-50 dark:bg-red-900/20',
            text: 'text-red-600 dark:text-red-400',
            border: 'border-red-100 dark:border-red-900',
            dot: 'bg-red-500'
        },
        [Priority.CRITICAL]: {
            bg: 'bg-rose-100 dark:bg-rose-900/30',
            text: 'text-rose-700 dark:text-rose-300',
            border: 'border-rose-200 dark:border-rose-800',
            dot: 'bg-rose-600 animate-pulse'
        },
    };

    const style = priorityConfig[task.priority];

    // Progress Calculation
    const totalSub = task.subtasks?.length || 0;
    const completedSub = task.subtasks?.filter(s => s.isCompleted).length || 0;
    const progress = totalSub === 0 ? 0 : Math.round((completedSub / totalSub) * 100);

    return (
        <div
            onClick={() => onClick(task)}
            className="group bg-white/80 dark:bg-gray-800/60 backdrop-blur-md hover:bg-white dark:hover:bg-gray-800 p-5 rounded-[24px] shadow-sm hover:shadow-[0_15px_30px_rgb(0,0,0,0.08)] transition-all duration-500 ease-out border border-white/60 dark:border-gray-700 cursor-pointer relative flex flex-col gap-3 transform-gpu will-change-transform hover:-translate-y-1 hover:scale-[1.01]"
        >
            {/* Header */}
            <div className="flex justify-between items-start">
                <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${style.bg} ${style.border} transition-transform group-hover:scale-105`}>
                    <div className={`w-2 h-2 rounded-full ${style.dot}`}/>
                    <span className={`text-[10px] font-bold ${style.text}`}>
              {task.priority === Priority.CRITICAL ? 'بحرانی' : task.priority === Priority.HIGH ? 'بالا' : task.priority === Priority.MEDIUM ? 'متوسط' : 'پایین'}
            </span>
                </div>
                <button
                    className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                    <MoreHorizontal size={18}/>
                </button>
            </div>

            {/* Content */}
            <div>
                <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg mb-1 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">{task.title}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 h-8 leading-relaxed opacity-80">{task.description}</p>
            </div>

            {/* Tags & Date */}
            <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500 mt-1">
                <div
                    className="flex items-center gap-1 bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded-lg transition-colors group-hover:bg-blue-50 dark:group-hover:bg-blue-900/10 group-hover:text-blue-500">
                    <Calendar size={12}/>
                    <span>{formatJalali(task.dueDate)}</span>
                </div>
                {task.tags && task.tags.length > 0 && (
                    <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded-lg">
                        <Tag size={12}/>
                        <span>{task.tags[0]}</span>
                    </div>
                )}
            </div>

            {/* Footer: Progress & Assignee */}
            <div
                className="flex justify-between items-center border-t border-gray-100 dark:border-gray-700/50 pt-4 mt-2">
                {/* Subtasks Progress */}
                {totalSub > 0 ? (
                    <div className="flex flex-col gap-1 w-24">
                        <div className="flex justify-between text-[9px] font-bold text-gray-400">
                            <span className="flex items-center gap-1"><CheckSquare size={10}/> {completedSub}/{totalSub}</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-1000 ease-out ${progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                                style={{width: `${progress}%`}}
                            />
                        </div>
                    </div>
                ) : (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 italic">بدون زیرتسک</span>
                )}

                {assignee && (
                    <div className="relative group/avatar">
                        <img
                            src={assignee.avatar}
                            alt={assignee.name}
                            className="w-9 h-9 rounded-full border-2 border-white dark:border-gray-800 shadow-sm object-cover transition-transform group-hover:scale-110"
                        />
                        <div
                            className="absolute -bottom-8 right-1/2 translate-x-1/2 bg-black/80 text-white text-[10px] px-2 py-1 rounded-md opacity-0 group-hover/avatar:opacity-100 transition-opacity whitespace-nowrap pointer-events-none transform translate-y-2 group-hover/avatar:translate-y-0 duration-200">
                            {assignee.name}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    // Custom comparison function for React.memo
    return (
        prevProps.task.id === nextProps.task.id &&
        prevProps.task.title === nextProps.task.title &&
        prevProps.task.status === nextProps.task.status &&
        prevProps.task.priority === nextProps.task.priority &&
        prevProps.task.description === nextProps.task.description &&
        prevProps.task.subtasks?.length === nextProps.task.subtasks?.length &&
        prevProps.task.subtasks?.filter(s => s.isCompleted).length === nextProps.task.subtasks?.filter(s => s.isCompleted).length &&
        prevProps.allUsers === nextProps.allUsers
    );
});

export default TaskCard;
