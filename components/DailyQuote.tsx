import React, { useEffect, useState } from 'react';
import { Quote } from '../services/quoteService';
import { getDailyQuote } from '../services/quoteService';
import { Sparkles, Quote as QuoteIcon } from 'lucide-react';

export const DailyQuote: React.FC = () => {
    const [quote, setQuote] = useState<Quote | null>(null);

    useEffect(() => {
        setQuote(getDailyQuote());
    }, []);

    if (!quote) return null;

    return (
        <div className="relative overflow-hidden rounded-[2rem] bg-white/40 dark:bg-gray-800/40 backdrop-blur-xl border border-white/50 dark:border-gray-700 p-6 shadow-sm group hover:shadow-lg transition-all duration-500 mb-8">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
            
            <div className="relative z-10 flex flex-col items-center text-center">
                <div className="mb-4 bg-gradient-to-tr from-blue-600 to-indigo-600 p-3 rounded-2xl shadow-lg shadow-blue-500/30 text-white transform -rotate-3 group-hover:rotate-0 transition-transform">
                    <QuoteIcon size={24} fill="currentColor" />
                </div>
                
                <h3 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white mb-3 leading-relaxed tracking-tight">
                    {quote.text}
                </h3>
                
                <div className="flex items-center gap-2 mt-2">
                    <span className="h-px w-8 bg-gray-300 dark:bg-gray-600"></span>
                    <p className="text-sm font-bold text-gray-500 dark:text-gray-400">{quote.author}</p>
                    <span className="h-px w-8 bg-gray-300 dark:bg-gray-600"></span>
                </div>
            </div>
        </div>
    );
};