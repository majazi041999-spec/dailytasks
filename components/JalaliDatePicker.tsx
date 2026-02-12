
import React, { useEffect, useState } from 'react';
import { gregorianToJalali, jalaliToGregorian, jalaliMonthNames } from '../utils/dateUtils';
import { Calendar } from 'lucide-react';

interface JalaliDatePickerProps {
    label?: string;
    value: string; // Expecting ISO string or YYYY-MM-DD
    onChange: (isoDate: string) => void;
}

const JalaliDatePicker: React.FC<JalaliDatePickerProps> = ({ label, value, onChange }) => {
    const [jy, setJy] = useState(1404);
    const [jm, setJm] = useState(1);
    const [jd, setJd] = useState(1);

    // Sync state with incoming value
    useEffect(() => {
        if (value) {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                const [y, m, d] = gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
                setJy(y);
                setJm(m);
                setJd(d);
            }
        } else {
            // Default to Today if empty
            const now = new Date();
            const [y, m, d] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
            setJy(y);
            setJm(m);
            setJd(d);
        }
    }, [value]);

    const handleChange = (newY: number, newM: number, newD: number) => {
        // Validate Day count in month
        let validD = newD;
        if (newM <= 6 && newD > 31) validD = 31;
        if (newM > 6 && newD > 30) validD = 30;
        // Esfand leap year check is complex, safely max at 29 or 30, keeping simple logic:
        if (newM === 12 && newD > 29) {
            // Simple leap check for UX (not perfect astro)
            const isLeap = ((((newY + 38) * 31) % 128) <= 30);
            validD = isLeap ? 30 : 29;
        }

        const [gy, gm, gd] = jalaliToGregorian(newY, newM, validD);
        const date = new Date(gy, gm - 1, gd);
        // Set time to noon to avoid timezone rolling issues causing day shift
        date.setHours(12, 0, 0, 0);
        onChange(date.toISOString());
    };

    const days = Array.from({ length: 31 }, (_, i) => i + 1);
    // Generate years range: current year - 5 to + 10
    const currentYear = 1404;
    const years = Array.from({ length: 20 }, (_, i) => currentYear - 5 + i);

    return (
        <div className="w-full">
            {label && <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">{label}</label>}
            <div className="flex bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-1 gap-1">
                {/* Day */}
                <select
                    value={jd}
                    onChange={(e) => handleChange(jy, jm, parseInt(e.target.value))}
                    className="flex-1 bg-transparent text-center font-bold text-gray-800 dark:text-white text-sm py-2 outline-none rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer appearance-none"
                >
                    {days.map(d => (
                        <option key={d} value={d}>{d}</option>
                    ))}
                </select>

                <div className="w-px bg-gray-200 dark:bg-gray-700 my-2"></div>

                {/* Month */}
                <select
                    value={jm}
                    onChange={(e) => handleChange(jy, parseInt(e.target.value), jd)}
                    className="flex-[2] bg-transparent text-center font-bold text-gray-800 dark:text-white text-sm py-2 outline-none rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer appearance-none"
                >
                    {jalaliMonthNames.map((name, i) => (
                        <option key={i} value={i + 1}>{name}</option>
                    ))}
                </select>

                <div className="w-px bg-gray-200 dark:bg-gray-700 my-2"></div>

                {/* Year */}
                <select
                    value={jy}
                    onChange={(e) => handleChange(parseInt(e.target.value), jm, jd)}
                    className="flex-[1.5] bg-transparent text-center font-bold text-gray-800 dark:text-white text-sm py-2 outline-none rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer appearance-none"
                >
                    {years.map(y => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>

                <div className="flex items-center justify-center px-2 text-blue-500">
                    <Calendar size={16} />
                </div>
            </div>
        </div>
    );
};

export default JalaliDatePicker;
