
import { Task, TaskStatus, Priority, User, ActionLog, Message, CalendarEvent, Notification, UserRole } from '../types';

const apiBaseFromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined;

// Fallback to current hostname for easy LAN testing in local environments
const hostname = window.location.hostname || 'localhost';
const API_URL = apiBaseFromEnv || `http://${hostname}:3001/api`;

const TOKEN_KEY = 'modiriat_token_v3';
const USER_KEY = 'modiriat_user_v3';

let presenceEndpointAvailable: boolean | null = null;

// Retry logic for 503 (Initializing) and Network Errors (Crash/Restart)
const fetchJson = async (url: string, options?: RequestInit, retries = 100, backoff = 1000): Promise<any> => {
    try {
        const token = localStorage.getItem(TOKEN_KEY);
        const headers: any = { 'Content-Type': 'application/json' };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(`${API_URL}${url}`, {
            headers: { ...headers, ...options?.headers },
            ...options
        });

        if (!res.ok) {
            // Server says "Wait" (503)
            if (res.status === 503) {
                if (retries > 0) {
                    // Silent wait, minimal log
                    if (retries % 5 === 0) console.log(`⏳ Server initializing... (${retries} retries left)`);
                    await new Promise(resolve => setTimeout(resolve, backoff));
                    return fetchJson(url, options, retries - 1, backoff);
                }
                throw new Error("SERVICE_UNAVAILABLE");
            }

            if (res.status === 401) {
                throw new Error("UNAUTHORIZED");
            }

            let errorMessage = `HTTP ${res.status} ${res.statusText}`;
            try {
                const errorBody = await res.json();
                if (errorBody && typeof errorBody === 'object') {
                    errorMessage = errorBody.error || errorBody.message || JSON.stringify(errorBody);
                }
            } catch (e) { }

            throw new Error(errorMessage);
        }
        return res.json();
    } catch (err: any) {
        // Network Error / Connection Refused / Server Crashed (Empty Response)
        if (retries > 0 && (err.message === 'Failed to fetch' || err.name === 'TypeError')) {
            if (retries % 5 === 0) console.log(`🔌 Connection retry... (${retries} left)`);
            await new Promise(resolve => setTimeout(resolve, backoff));
            return fetchJson(url, options, retries - 1, backoff);
        }

        const isPresence404 = url === '/presence' && String(err?.message || '').includes('404');
        if (err.message !== "UNAUTHORIZED" && err.message !== "SERVICE_UNAVAILABLE" && !isPresence404) {
            console.error(`Fetch Error [${url}]:`, err);
        }
        throw err;
    }
};


export const getRealtimeSocketUrl = (): string => {
    const wsBase = API_URL.replace(/^http/i, 'ws').replace(/\/api$/, '');
    const token = localStorage.getItem(TOKEN_KEY) || '';
    return `${wsBase}/ws?token=${encodeURIComponent(token)}`;
};

export const getAuthToken = (): string | null => localStorage.getItem(TOKEN_KEY);

export const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

export const MockBackend = {
    // --- AUTH & SESSION ---
    authenticate: async (username: string, password: string): Promise<User | null> => {
        try {
            const response = await fetchJson('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });

            if (response.user && response.token) {
                localStorage.setItem(TOKEN_KEY, response.token);
                localStorage.setItem(USER_KEY, JSON.stringify(response.user));
                return response.user;
            }
            return null;
        } catch (e) {
            console.error(e);
            return null;
        }
    },

    getCachedUser: (): User | null => {
        try {
            const stored = localStorage.getItem(USER_KEY);
            return stored ? JSON.parse(stored) : null;
        } catch (e) {
            return null;
        }
    },

    validateSession: async (): Promise<User | null> => {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) return null;

        try {
            const user = await fetchJson('/auth/me');
            if (user) {
                localStorage.setItem(USER_KEY, JSON.stringify(user));
            }
            return user;
        } catch (e: any) {
            if (e.message === "UNAUTHORIZED") return null;
            // If server is unavailable, use cached user optimistically
            return MockBackend.getCachedUser();
        }
    },

    endSession: async () => {
        try {
            await fetchJson('/auth/logout', { method: 'POST' });
        } catch (e) {}
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        console.log("Session ended");
    },

    // --- USERS ---
    getAllUsers: async (): Promise<User[]> => {
        return fetchJson('/users');
    },

    getOnlineUserIds: async (): Promise<string[]> => {
        // Backward compatibility: if backend doesn't expose /api/presence, stop retrying this call.
        if (presenceEndpointAvailable === false) {
            return [];
        }

        try {
            const response = await fetchJson('/presence');
            presenceEndpointAvailable = true;
            return response?.onlineUserIds || [];
        } catch (e: any) {
            if (e?.message?.includes('404')) {
                presenceEndpointAvailable = false;
                return [];
            }
            throw e;
        }
    },

    saveUser: async (user: any): Promise<User> => {
        return fetchJson('/users', {
            method: 'POST',
            body: JSON.stringify(user)
        });
    },

    updateUser: async (user: User & { password?: string }): Promise<User> => {
        const updated = await fetchJson(`/users/${user.id}`, {
            method: 'PUT',
            body: JSON.stringify(user)
        });

        // If we updated current user, update cache
        const currentUser = MockBackend.getCachedUser();
        if (currentUser && currentUser.id === updated.id) {
            localStorage.setItem(USER_KEY, JSON.stringify(updated));
        }
        return updated;
    },

    deleteUser: async (userId: string): Promise<void> => {
        await fetchJson(`/users/${userId}`, { method: 'DELETE' });
    },

    // --- TASKS ---
    getTasks: async (): Promise<Task[]> => {
        return fetchJson('/tasks');
    },

    saveTask: async (task: Task): Promise<Task> => {
        const existingTasks: Task[] = await MockBackend.getTasks();
        const existing = existingTasks.find(t => t.id === task.id);
        let action: 'CREATED' | 'UPDATED' = existing ? 'UPDATED' : 'CREATED';

        if (existing) {
            if (existing.status !== task.status) {
                if (task.status === TaskStatus.IN_REVIEW) {
                    await MockBackend.createNotification(task.assignedById, `تسک "${task.title}" منتظر بررسی و تایید شماست.`, 'SYSTEM', task.id);
                } else if (task.status === TaskStatus.DONE) {
                    await MockBackend.createNotification(task.assigneeId, `تسک "${task.title}" تایید و بسته شد.`, 'SYSTEM', task.id);
                }
            }
        } else {
            // NEW TASK: Send High Priority Notification
            if (task.assigneeId !== task.assignedById) {
                await MockBackend.createNotification(
                    task.assigneeId,
                    `تسک جدید: "${task.title}" به شما محول شد.`,
                    'TASK_ASSIGNMENT', // This triggers the alarm overlay in Layout.tsx
                    task.id
                );
            }
        }

        const savedTask = await fetchJson('/tasks', {
            method: 'POST',
            body: JSON.stringify(task)
        });

        await MockBackend.logAction(task.id, action, `تسک "${task.title}" ${action === 'CREATED' ? 'ایجاد شد' : 'بروزرسانی شد'}`);
        return savedTask;
    },

    deleteTask: async (taskId: string): Promise<void> => {
        await fetchJson(`/tasks/${taskId}`, { method: 'DELETE' });
    },

    // --- MESSAGES ---
    getMessages: async (userId: string): Promise<Message[]> => {
        return fetchJson(`/messages?userId=${userId}`);
    },

    sendMessage: async (msg: Message): Promise<Message> => {
        const savedMsg = await fetchJson('/messages', {
            method: 'POST',
            body: JSON.stringify(msg)
        });

        const users = await MockBackend.getAllUsers();
        const senderName = users.find(u => u.id === msg.senderId)?.name || 'کاربر';
        // Simplified notification message
        const notifText = msg.attachment ? `فایل جدید از طرف ${senderName}` : `پیام جدید از طرف ${senderName}`;
        await MockBackend.createNotification(msg.receiverId, notifText, 'SYSTEM');

        return savedMsg;
    },

    updateMessage: async (msg: Message): Promise<Message> => {
        return fetchJson(`/messages/${msg.id}`, {
            method: 'PUT',
            body: JSON.stringify(msg)
        });
    },

    deleteMessage: async (msgId: string): Promise<void> => {
        await fetchJson(`/messages/${msgId}`, { method: 'DELETE' });
    },

    deleteConversation: async (user1Id: string, user2Id: string): Promise<void> => {
        await fetchJson('/messages/conversation', {
            method: 'DELETE',
            body: JSON.stringify({ user1: user1Id, user2: user2Id })
        });
    },

    // --- EVENTS ---
    getEvents: async (userId: string, userRole: UserRole): Promise<CalendarEvent[]> => {
        const events: CalendarEvent[] = await fetchJson('/events');
        return events.filter(e => e.isPublic || e.ownerId === userId || e.attendees?.includes(userId));
    },

    saveEvent: async (event: CalendarEvent): Promise<CalendarEvent> => {
        const saved = await fetchJson('/events', {
            method: 'POST',
            body: JSON.stringify(event)
        });
        await MockBackend.logAction(event.id, 'EVENT', `رویداد "${event.title}" ذخیره شد.`);
        return saved;
    },

    deleteEvent: async (eventId: string): Promise<void> => {
        await fetchJson(`/events/${eventId}`, { method: 'DELETE' });
    },

    // --- NOTIFICATIONS & LOGS ---
    getLogs: async (): Promise<ActionLog[]> => {
        return fetchJson('/logs');
    },

    logAction: async (taskId: string | undefined | null, action: ActionLog['action'], details: string) => {
        const token = localStorage.getItem(TOKEN_KEY);
        // Best effort log, might fail if session invalid, but logic is sound
        if (!token) return;

        try {
            const currentUser = MockBackend.getCachedUser();
            if (!currentUser) return;

            const newLog: ActionLog = {
                id: generateUUID(),
                taskId: taskId || undefined,
                userId: currentUser.id,
                action,
                timestamp: new Date().toISOString(),
                details
            };

            // Don't wait for logs
            fetchJson('/logs', {
                method: 'POST',
                body: JSON.stringify(newLog)
            }).catch(e => console.log('Log error (ignored)', e.message));
        } catch(e) {}
    },

    getNotifications: async (userId: string): Promise<Notification[]> => {
        return fetchJson(`/notifications?userId=${userId}`);
    },

    createNotification: async (userId: string, message: string, type: 'ALARM' | 'SYSTEM' | 'TASK_ASSIGNMENT' = 'SYSTEM', relatedId?: string) => {
        const newNotif: Partial<Notification> = {
            id: generateUUID(),
            userId,
            message,
            isRead: false,
            timestamp: new Date().toISOString(),
            type,
            relatedId
        };
        await fetchJson('/notifications', {
            method: 'POST',
            body: JSON.stringify(newNotif)
        });
    },

    markNotificationRead: async (notifId: string) => {
        await fetchJson(`/notifications/${notifId}/read`, { method: 'PUT' });
    },

    saveCustomSound: (base64: string) => {
        localStorage.setItem('app_custom_sound', base64);
    },

    getCustomSound: (): string | null => {
        return localStorage.getItem('app_custom_sound');
    }
};
