
import { GoogleGenAI } from "@google/genai";
import { Task, User } from "../types";

// NOTE: In a real production app, never expose API keys on the client side.
const API_KEY = process.env.API_KEY || 'AIzaSyAGwjAJgsjHclfhE1aIXq5sJ4BMJkOMQmg';

const ai = new GoogleGenAI({ apiKey: API_KEY });

const SYSTEM_INSTRUCTION = `
شما "دستیار هوشمند تسکچی" هستید. یک همکار دانشمند، مهربان، حرفه‌ای و با انگیزه.
لحن شما باید صمیمی اما محترمانه باشد (مثل یک مدیر محصول باتجربه و خوش‌برخورد).
همیشه پاسخ‌های فارسی، روان و ساختاریافته بدهید.
از ایموجی‌های مرتبط استفاده کنید تا فضا خشک نباشد.
`;

export const analyzeTasksWithAI = async (tasks: Task[]): Promise<string> => {
    if (!API_KEY) return "کلید API تنظیم نشده است.";

    const prompt = `
    ${SYSTEM_INSTRUCTION}
    
    لطفاً لیست تسک‌های زیر را بررسی کن و یک گزارش مدیریتی کوتاه و جذاب (حداکثر ۴ خط) بنویس.
    ۱. وضعیت کلی پروژه چطور است؟
    ۲. روی چه چیزی باید تمرکز کنیم؟
    ۳. یک جمله انگیزشی در پایان بگو.
    
    لیست تسک‌ها: ${JSON.stringify(tasks.map(t => ({ title: t.title, priority: t.priority, status: t.status })))}
  `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text || "خطا در تحلیل داده‌ها.";
    } catch (error) {
        console.error("Gemini Error:", error);
        return "متاسفانه در حال حاضر امکان ارتباط با مغز متفکر سیستم وجود ندارد.";
    }
};

export const analyzeTeamPerformance = async (users: User[], tasks: Task[]): Promise<string> => {
    if (!API_KEY) return "کلید API تنظیم نشده است.";

    // Simplify data for token efficiency
    const teamData = users.map(u => {
        const userTasks = tasks.filter(t => t.assigneeId === u.id);
        const completed = userTasks.filter(t => t.status === 'DONE').length;
        const total = userTasks.length;
        return { name: u.name, role: u.role, totalTasks: total, completedTasks: completed };
    });

    const prompt = `
      ${SYSTEM_INSTRUCTION}
      
      لطفاً عملکرد تیم زیر را تحلیل کن.
      بدون اینکه کسی را سرزنش کنی، نقاط قوت تیم را بگو و اگر کسی بار کاری زیادی دارد هوشمندانه اشاره کن.
      پیشنهاد بده چطور می‌توانند بهره‌وری را بالا ببرند.
      
      داده‌های تیم: ${JSON.stringify(teamData)}
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text || "تحلیل تیم انجام نشد.";
    } catch (error) {
        return "خطا در تحلیل تیم.";
    }
};

export const askAIGeneral = async (question: string, contextTasks: Task[]): Promise<string> => {
    if (!API_KEY) return "کلید API موجود نیست.";

    // Provide simplified context about current high priority tasks
    const context = contextTasks
        .filter(t => t.priority === 'CRITICAL' || t.priority === 'HIGH')
        .map(t => t.title)
        .join(', ');

    const prompt = `
        ${SYSTEM_INSTRUCTION}
        
        کاربر پرسیده: "${question}"
        
        (جهت اطلاع تو، تسک‌های مهم فعلی این‌ها هستند: ${context})
        
        پاسخ کاربر را دقیق و کاربردی بده. اگر سوال فنی است، راهنمایی کن. اگر مربوط به مدیریت زمان است، تکنیک یاد بده.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text || "پاسخی دریافت نشد.";
    } catch (error) {
        return "مشکلی در گفتگو پیش آمده.";
    }
};

export const generateSubtasks = async (taskTitle: string): Promise<string[]> => {
    if (!API_KEY) return [];
    if (!taskTitle) return [];

    const prompt = `
        برای تسک "${taskTitle}"، ۵ تا ۷ زیرتسک اجرایی و کوتاه بنویس.
        خروجی فقط آرایه JSON باشد.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });

        const text = response.text || "[]";
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error("Gemini Subtask Error:", error);
        return [];
    }
}
