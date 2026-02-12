
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationControlProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    variant?: 'compact' | 'full';
}

const PaginationControl: React.FC<PaginationControlProps> = ({ currentPage, totalPages, onPageChange, variant = 'full' }) => {
    if (totalPages <= 1) return null;

    return (
        <div className={`flex items-center justify-center gap-2 mt-4 animate-in fade-in slide-in-from-bottom-2 ${variant === 'compact' ? 'scale-90' : ''}`}>
            <button
                onClick={(e) => { e.stopPropagation(); onPageChange(currentPage - 1); }}
                disabled={currentPage === 1}
                className="p-2 rounded-xl bg-white/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent transition-all shadow-sm text-gray-700 dark:text-gray-200"
            >
                <ChevronRight size={16} />
            </button>

            <div className="bg-white/50 dark:bg-gray-800/50 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 shadow-sm border border-white/40 dark:border-gray-700/50 min-w-[60px] text-center">
                صفحه {currentPage} از {totalPages}
            </div>

            <button
                onClick={(e) => { e.stopPropagation(); onPageChange(currentPage + 1); }}
                disabled={currentPage === totalPages}
                className="p-2 rounded-xl bg-white/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent transition-all shadow-sm text-gray-700 dark:text-gray-200"
            >
                <ChevronLeft size={16} />
            </button>
        </div>
    );
};

export default PaginationControl;
