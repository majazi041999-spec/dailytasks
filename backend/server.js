
const express = require('express');
const { Pool } = require('pg');
const { createClient } = require('redis');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');

// --- SAFETY NET ---
process.on('uncaughtException', (err) => console.error('⚠️ Uncaught Exception:', err.message));
process.on('unhandledRejection', (reason) => console.error('⚠️ Unhandled Rejection:', reason));

const app = express();
const port = 3001;

// State Flags
let isDbReady = false;
let isRedisReady = false;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// Health Check Middleware
app.use((req, res, next) => {
    if (req.path === '/api/health') {
        return res.json({
            status: isDbReady ? 'UP' : 'INITIALIZING',
            db: isDbReady,
            redis: isRedisReady
        });
    }

    if (!isDbReady) {
        return res.status(503).json({
            error: 'System is initializing...',
            retryAfter: 2
        });
    }
    next();
});

// Logging
app.use((req, res, next) => {
    if (req.path !== '/api/health') {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    }
    next();
});

// --- POSTGRESQL CONFIG ---
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'modiriat_db',
    password: process.env.DB_PASSWORD || 'password',
    port: 5432,
    connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => console.error('⚠️ Database Pool Error:', err.message));

// --- REDIS CONFIG (OPTIONAL CACHE) ---
const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
        reconnectStrategy: (retries) => Math.min(retries * 500, 2000),
        connectTimeout: 3000
    }
});

redisClient.on('error', (err) => { isRedisReady = false; });
redisClient.on('ready', () => { isRedisReady = true; console.log('✅ Redis Connected'); });

(async () => {
    try { await redisClient.connect(); } catch (e) { console.log("ℹ️ Redis optional."); }
})();

const toCamel = (o) => {
    if (o === null || o === undefined) return o;
    if (Array.isArray(o)) return o.map(toCamel);
    if (o.constructor === Object) {
        const newO = {};
        Object.keys(o).forEach((key) => {
            const newKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
            newO[newKey] = toCamel(o[key]);
        });
        return newO;
    }
    return o;
};

// --- DB INIT ---
const initDb = async () => {
    while (true) {
        try {
            const client = await pool.connect();
            try {
                await client.query('SELECT 1');
                console.log("✅ Database Connected.");

                await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

                // Schema - Ensure Tables Exist
                await client.query(`
                    CREATE TABLE IF NOT EXISTS users (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        username VARCHAR(50) UNIQUE NOT NULL,
                        password_hash VARCHAR(255) NOT NULL,
                        name VARCHAR(100) NOT NULL,
                        role VARCHAR(20) CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'USER')),
                        avatar TEXT,
                        created_by UUID REFERENCES users(id),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                    
                    CREATE TABLE IF NOT EXISTS sessions (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                        token VARCHAR(255) UNIQUE NOT NULL,
                        expires_at TIMESTAMP NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );

                    CREATE TABLE IF NOT EXISTS tasks (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        title VARCHAR(200) NOT NULL,
                        description TEXT,
                        rich_description JSONB DEFAULT '[]',
                        priority VARCHAR(10),
                        status VARCHAR(20),
                        assignee_id UUID REFERENCES users(id),
                        assigned_by_id UUID REFERENCES users(id),
                        due_date TIMESTAMP,
                        tags TEXT[],
                        subtasks JSONB DEFAULT '[]',
                        alarms JSONB DEFAULT '[]',
                        updates JSONB DEFAULT '[]',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );

                    CREATE TABLE IF NOT EXISTS events (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        title VARCHAR(200) NOT NULL,
                        description TEXT,
                        start_time TIMESTAMP NOT NULL,
                        end_time TIMESTAMP NOT NULL,
                        owner_id UUID REFERENCES users(id),
                        is_public BOOLEAN DEFAULT FALSE,
                        location VARCHAR(200),
                        color VARCHAR(20),
                        attendees TEXT[],
                        alarms JSONB DEFAULT '[]',
                        event_todos JSONB DEFAULT '[]',
                        rich_notes JSONB DEFAULT '[]',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );

                    CREATE TABLE IF NOT EXISTS messages (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        sender_id UUID REFERENCES users(id),
                        receiver_id UUID REFERENCES users(id),
                        content TEXT NOT NULL,
                        is_read BOOLEAN DEFAULT FALSE,
                        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        attachment TEXT,
                        attachment_type VARCHAR(20),
                        attachment_name VARCHAR(255)
                    );

                    CREATE TABLE IF NOT EXISTS notifications (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_id UUID REFERENCES users(id),
                        message TEXT NOT NULL,
                        is_read BOOLEAN DEFAULT FALSE,
                        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        type VARCHAR(50),
                        related_id UUID
                    );

                    CREATE TABLE IF NOT EXISTS action_logs (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_id UUID REFERENCES users(id),
                        task_id UUID,
                        action VARCHAR(50),
                        details TEXT,
                        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                `);

                // --- MIGRATION: ADD MESSAGE COLUMNS IF MISSING ---
                try {
                    await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment TEXT`);
                    await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_type VARCHAR(20)`);
                    await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255)`);
                } catch (e) {
                    console.log("ℹ️ Message schema migration info:", e.message);
                }

                // --- MIGRATION: APPLY CASCADE DELETE TO EXISTING TABLES ---
                try {
                    console.log("🛠️ Applying Cascade Constraints...");

                    const cascadeUpdates = [
                        // Messages
                        { t: 'messages', c: 'sender_id', f: 'messages_sender_id_fkey' },
                        { t: 'messages', c: 'receiver_id', f: 'messages_receiver_id_fkey' },
                        // Notifications
                        { t: 'notifications', c: 'user_id', f: 'notifications_user_id_fkey' },
                        // Logs
                        { t: 'action_logs', c: 'user_id', f: 'action_logs_user_id_fkey' },
                        // Tasks (When user is deleted, their assigned tasks also get deleted for cleanup)
                        { t: 'tasks', c: 'assignee_id', f: 'tasks_assignee_id_fkey' },
                        { t: 'tasks', c: 'assigned_by_id', f: 'tasks_assigned_by_id_fkey' },
                        // Events
                        { t: 'events', c: 'owner_id', f: 'events_owner_id_fkey' },
                        // Users (Created By)
                        { t: 'users', c: 'created_by', f: 'users_created_by_fkey' }
                    ];

                    for (const item of cascadeUpdates) {
                        // 1. Drop existing constraint
                        await client.query(`ALTER TABLE ${item.t} DROP CONSTRAINT IF EXISTS ${item.f}`);
                        // 2. Re-add constraint with ON DELETE CASCADE
                        await client.query(`ALTER TABLE ${item.t} ADD CONSTRAINT ${item.f} FOREIGN KEY (${item.c}) REFERENCES users(id) ON DELETE CASCADE`);
                    }
                    console.log("✅ Database Constraints Updated (Cascade Delete Enabled).");
                } catch (migErr) {
                    console.warn("ℹ️ Migration warning (safe to ignore if fresh DB):", migErr.message);
                }

                // Seed - ONLY SUPER ADMIN
                await client.query(`
                    INSERT INTO users (username, password_hash, name, role, avatar)
                    VALUES 
                    ('admin', '123', 'مدیر کل (Super Admin)', 'SUPER_ADMIN', 'https://i.pravatar.cc/150?u=1')
                    ON CONFLICT (username) DO NOTHING;
                `);

                isDbReady = true;
                client.release();
                break;
            } catch (queryErr) {
                client.release();
                throw queryErr;
            }
        } catch (err) {
            console.log(`⏳ DB Retry... (${err.message})`);
            await new Promise(res => setTimeout(res, 3000));
        }
    }
};

// --- ROUTES ---

const safeQuery = async (req, res, operation) => {
    if (!isDbReady) return res.status(503).json({ error: 'Database not ready' });
    try { await operation(); } catch (err) { res.status(500).json({ error: err.message }); }
};

// AUTH: Login
app.post('/api/auth/login', (req, res) => safeQuery(req, res, async () => {
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE username = $1 AND password_hash = $2', [username, password]);

    if (result.rows.length > 0) {
        const user = toCamel(result.rows[0]);
        const token = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24); // 24h validity

        // Persistent Session in DB
        await pool.query(
            'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [user.id, token, expiresAt]
        );

        // Cache in Redis (optional)
        if (isRedisReady) {
            redisClient.set(token, JSON.stringify(user), { EX: 86400 }).catch(() => {});
        }

        res.json({ user, token });
    } else {
        res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است.' });
    }
}));

// AUTH: Me (Validate Session)
app.get('/api/auth/me', (req, res) => safeQuery(req, res, async () => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token' });
    const token = authHeader.split(' ')[1];

    // 1. Check Redis Cache first
    if (isRedisReady) {
        const cached = await redisClient.get(token);
        if (cached) return res.json(JSON.parse(cached));
    }

    // 2. Fallback to Persistent DB
    const result = await pool.query(`
        SELECT u.* FROM users u
        JOIN sessions s ON s.user_id = u.id
        WHERE s.token = $1 AND s.expires_at > NOW()
    `, [token]);

    if (result.rows.length > 0) {
        const user = toCamel(result.rows[0]);
        // Re-cache in Redis if it recovered
        if (isRedisReady) {
            redisClient.set(token, JSON.stringify(user), { EX: 86400 }).catch(() => {});
        }
        res.json(user);
    } else {
        res.status(401).json({ error: 'Session Expired' });
    }
}));

app.post('/api/auth/logout', (req, res) => safeQuery(req, res, async () => {
    if (req.headers.authorization) {
        const token = req.headers.authorization.split(' ')[1];
        await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
        if (isRedisReady) redisClient.del(token).catch(() => {});
    }
    res.json({ success: true });
}));

// Users
app.get('/api/users', (req, res) => safeQuery(req, res, async () => {
    const r = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
    res.json(toCamel(r.rows));
}));
app.post('/api/users', (req, res) => safeQuery(req, res, async () => {
    const { name, username, password, role, avatar, createdBy } = req.body;
    const r = await pool.query('INSERT INTO users (name, username, password_hash, role, avatar, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [name, username, password, role, avatar, createdBy]);
    res.json(toCamel(r.rows[0]));
}));
app.put('/api/users/:id', (req, res) => safeQuery(req, res, async () => {
    const { id } = req.params;
    const { name, username, role, avatar, password } = req.body;
    let q = password ? 'UPDATE users SET name=$1, username=$2, role=$3, avatar=$4, password_hash=$5 WHERE id=$6 RETURNING *' : 'UPDATE users SET name=$1, username=$2, role=$3, avatar=$4 WHERE id=$5 RETURNING *';
    let p = password ? [name, username, role, avatar, password, id] : [name, username, role, avatar, id];
    const r = await pool.query(q, p);
    res.json(toCamel(r.rows[0]));
}));
app.delete('/api/users/:id', (req, res) => safeQuery(req, res, async () => {
    await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    res.json({success:true});
}));

// Tasks
app.get('/api/tasks', (req, res) => safeQuery(req, res, async () => {
    const r = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
    res.json(toCamel(r.rows));
}));
app.post('/api/tasks', (req, res) => safeQuery(req, res, async () => {
    const t = req.body;
    const check = await pool.query('SELECT id FROM tasks WHERE id = $1', [t.id]);
    let r;
    if (check.rows.length > 0) {
        r = await pool.query(`UPDATE tasks SET title=$1, description=$2, priority=$3, status=$4, assignee_id=$5, due_date=$6, tags=$7, subtasks=$8, alarms=$9, updates=$10, rich_description=$11 WHERE id=$12 RETURNING *`,
            [t.title, t.description, t.priority, t.status, t.assigneeId, t.dueDate, t.tags, JSON.stringify(t.subtasks), JSON.stringify(t.alarms), JSON.stringify(t.updates), JSON.stringify(t.richDescription), t.id]);
    } else {
        r = await pool.query(`INSERT INTO tasks (id, title, description, priority, status, assignee_id, assigned_by_id, due_date, tags, subtasks, alarms, updates, rich_description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
            [t.id || undefined, t.title, t.description, t.priority, t.status, t.assigneeId, t.assignedById, t.dueDate, t.tags, JSON.stringify(t.subtasks), JSON.stringify(t.alarms), JSON.stringify(t.updates), JSON.stringify(t.richDescription)]);
    }
    res.json(toCamel(r.rows[0]));
}));
app.delete('/api/tasks/:id', (req, res) => safeQuery(req, res, async () => {
    await pool.query('DELETE FROM tasks WHERE id=$1', [req.params.id]);
    res.json({success:true});
}));

// Events
app.get('/api/events', (req, res) => safeQuery(req, res, async () => { const r = await pool.query('SELECT * FROM events'); res.json(toCamel(r.rows)); }));
app.post('/api/events', (req, res) => safeQuery(req, res, async () => {
    const e = req.body;
    const check = await pool.query('SELECT id FROM events WHERE id=$1', [e.id]);
    let r;
    if (check.rows.length > 0) {
        r = await pool.query(`UPDATE events SET title=$1, description=$2, start_time=$3, end_time=$4, is_public=$5, location=$6, color=$7, attendees=$8, alarms=$9, event_todos=$10, rich_notes=$11 WHERE id=$12 RETURNING *`,
            [e.title, e.description, e.startTime, e.endTime, e.isPublic, e.location, e.color, e.attendees, JSON.stringify(e.alarms), JSON.stringify(e.eventTodos), JSON.stringify(e.richNotes), e.id]);
    } else {
        r = await pool.query(`INSERT INTO events (id, title, description, start_time, end_time, owner_id, is_public, location, color, attendees, alarms, event_todos, rich_notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
            [e.id || undefined, e.title, e.description, e.startTime, e.endTime, e.ownerId, e.isPublic, e.location, e.color, e.attendees, JSON.stringify(e.alarms), JSON.stringify(e.eventTodos), JSON.stringify(e.richNotes)]);
    }
    res.json(toCamel(r.rows[0]));
}));
app.delete('/api/events/:id', (req, res) => safeQuery(req, res, async () => { await pool.query('DELETE FROM events WHERE id=$1', [req.params.id]); res.json({success:true}); }));

// Messages
app.get('/api/messages', (req, res) => safeQuery(req, res, async () => { const r = await pool.query('SELECT * FROM messages WHERE sender_id=$1 OR receiver_id=$1 ORDER BY timestamp ASC', [req.query.userId]); res.json(toCamel(r.rows)); }));
app.post('/api/messages', (req, res) => safeQuery(req, res, async () => {
    const { id, senderId, receiverId, content, isRead, timestamp, attachment, attachmentType, attachmentName } = req.body;
    const r = await pool.query('INSERT INTO messages (id, sender_id, receiver_id, content, is_read, timestamp, attachment, attachment_type, attachment_name) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *', [id, senderId, receiverId, content, isRead, timestamp, attachment, attachmentType, attachmentName]);
    res.json(toCamel(r.rows[0]));
}));

// Update Message (Edit)
app.put('/api/messages/:id', (req, res) => safeQuery(req, res, async () => {
    const { content, isRead } = req.body;
    const r = await pool.query('UPDATE messages SET content=COALESCE($1, content), is_read=COALESCE($2, is_read) WHERE id=$3 RETURNING *', [content, isRead, req.params.id]);
    res.json(toCamel(r.rows[0]));
}));

// Delete Single Message
app.delete('/api/messages/:id', (req, res) => safeQuery(req, res, async () => {
    await pool.query('DELETE FROM messages WHERE id=$1', [req.params.id]);
    res.json({success:true});
}));

// Delete Conversation
app.delete('/api/messages/conversation', (req, res) => safeQuery(req, res, async () => {
    const { user1, user2 } = req.body;
    await pool.query('DELETE FROM messages WHERE (sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1)', [user1, user2]);
    res.json({success:true});
}));

// Notifications
app.get('/api/notifications', (req, res) => safeQuery(req, res, async () => { const r = await pool.query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY timestamp DESC', [req.query.userId]); res.json(toCamel(r.rows)); }));
app.post('/api/notifications', (req, res) => safeQuery(req, res, async () => { const { id, userId, message, isRead, timestamp, type, relatedId } = req.body; const r = await pool.query('INSERT INTO notifications (id, user_id, message, is_read, timestamp, type, related_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *', [id, userId, message, isRead, timestamp, type, relatedId]); res.json(toCamel(r.rows[0])); }));
app.put('/api/notifications/:id/read', (req, res) => safeQuery(req, res, async () => { const r = await pool.query('UPDATE notifications SET is_read=TRUE WHERE id=$1 RETURNING *', [req.params.id]); res.json(toCamel(r.rows[0])); }));

// Logs
app.get('/api/logs', (req, res) => safeQuery(req, res, async () => { const r = await pool.query('SELECT * FROM action_logs ORDER BY timestamp DESC LIMIT 100'); res.json(toCamel(r.rows)); }));
app.post('/api/logs', (req, res) => safeQuery(req, res, async () => { const { id, userId, taskId, action, details, timestamp } = req.body; const r = await pool.query('INSERT INTO action_logs (id, user_id, task_id, action, details, timestamp) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [id, userId, taskId, action, details, timestamp]); res.json(toCamel(r.rows[0])); }));

// Start Server
app.listen(port, () => {
    console.log(`✅ Backend Server STARTED at http://localhost:${port}`);
    initDb();
});
