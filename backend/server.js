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

const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: false,
}));
app.use(bodyParser.json({ limit: '5mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 30;

const authLimiter = (req, res, next) => {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const current = loginAttempts.get(key) || { count: 0, resetAt: now + LOGIN_WINDOW_MS };

  if (now > current.resetAt) {
    current.count = 0;
    current.resetAt = now + LOGIN_WINDOW_MS;
  }

  current.count += 1;
  loginAttempts.set(key, current);

  if (current.count > LOGIN_MAX_ATTEMPTS) {
    return res.status(429).json({ error: 'تعداد تلاش زیاد است. لطفاً چند دقیقه دیگر دوباره تلاش کنید.' });
  }

  next();
};

const hashPassword = async (plainTextPassword) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await new Promise((resolve, reject) => {
    crypto.scrypt(plainTextPassword, salt, 64, (err, key) => {
      if (err) reject(err);
      else resolve(key.toString('hex'));
    });
  });
  return `scrypt:${salt}:${derivedKey}`;
};

const verifyPassword = async (plainTextPassword, storedHash) => {
  if (typeof storedHash !== 'string') return false;

  if (storedHash.startsWith('scrypt:')) {
    const [, salt, key] = storedHash.split(':');
    if (!salt || !key) return false;

    const derivedKey = await new Promise((resolve, reject) => {
      crypto.scrypt(plainTextPassword, salt, 64, (err, derived) => {
        if (err) reject(err);
        else resolve(derived.toString('hex'));
      });
    });

    const keyBuffer = Buffer.from(key, 'hex');
    const derivedBuffer = Buffer.from(derivedKey, 'hex');
    if (keyBuffer.length !== derivedBuffer.length) return false;
    return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
  }

  // Legacy plain-text compatibility
  return storedHash === plainTextPassword;
};

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

redisClient.on('error', () => { isRedisReady = false; });
redisClient.on('ready', () => { isRedisReady = true; console.log('✅ Redis Connected'); });

(async () => {
  try { await redisClient.connect(); } catch (e) { console.log('ℹ️ Redis optional.'); }
})();

const buildErrorResponse = (err, requestId) => {
  const isKnownError = ['UNAUTHORIZED', 'FORBIDDEN', 'VALIDATION_ERROR'].includes(err.message);
  if (isKnownError) {
    return { status: err.status || 400, body: { error: err.publicMessage || err.message, requestId } };
  }

  console.error(`❌ [${requestId}]`, err);
  return { status: 500, body: { error: 'خطای داخلی سرور رخ داد.', requestId } };
};

const safeQuery = async (req, res, operation) => {
  if (!isDbReady) return res.status(503).json({ error: 'Database not ready' });
  const requestId = crypto.randomUUID();
  try {
    await operation();
  } catch (err) {
    const response = buildErrorResponse(err, requestId);
    res.status(response.status).json(response.body);
  }
};

const requireAuth = async (req, _res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    const err = new Error('UNAUTHORIZED');
    err.status = 401;
    err.publicMessage = 'توکن احراز هویت ارسال نشده است.';
    throw err;
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    const err = new Error('UNAUTHORIZED');
    err.status = 401;
    err.publicMessage = 'توکن نامعتبر است.';
    throw err;
  }

  if (isRedisReady) {
    const cached = await redisClient.get(token);
    if (cached) {
      req.user = JSON.parse(cached);
      req.authToken = token;
      return;
    }
  }

  const result = await pool.query(`
    SELECT u.* FROM users u
    JOIN sessions s ON s.user_id = u.id
    WHERE s.token = $1 AND s.expires_at > NOW()
  `, [token]);

  if (result.rows.length === 0) {
    const err = new Error('UNAUTHORIZED');
    err.status = 401;
    err.publicMessage = 'نشست شما منقضی شده است.';
    throw err;
  }

  const user = toCamel(result.rows[0]);
  req.user = user;
  req.authToken = token;

  if (isRedisReady) {
    redisClient.set(token, JSON.stringify(user), { EX: 86400 }).catch(() => {});
  }
};

const requireRoles = (roles) => {
  return (req) => {
    if (!req.user || !roles.includes(req.user.role)) {
      const err = new Error('FORBIDDEN');
      err.status = 403;
      err.publicMessage = 'شما دسترسی لازم برای این عملیات را ندارید.';
      throw err;
    }
  };
};

const assertSelfOrAdmin = (req, targetUserId) => {
  const canAccess = req.user?.id === targetUserId || ['SUPER_ADMIN', 'ADMIN'].includes(req.user?.role);
  if (!canAccess) {
    const err = new Error('FORBIDDEN');
    err.status = 403;
    err.publicMessage = 'شما فقط به داده‌های خودتان دسترسی دارید.';
    throw err;
  }
};

// --- DB INIT ---
const initDb = async () => {
  while (true) {
    try {
      const client = await pool.connect();
      try {
        await client.query('SELECT 1');
        console.log('✅ Database Connected.');

        await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

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

        try {
          await client.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment TEXT');
          await client.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_type VARCHAR(20)');
          await client.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255)');
        } catch (e) {
          console.log('ℹ️ Message schema migration info:', e.message);
        }

        try {
          console.log('🛠️ Applying Cascade Constraints...');
          const cascadeUpdates = [
            { t: 'messages', c: 'sender_id', f: 'messages_sender_id_fkey' },
            { t: 'messages', c: 'receiver_id', f: 'messages_receiver_id_fkey' },
            { t: 'notifications', c: 'user_id', f: 'notifications_user_id_fkey' },
            { t: 'action_logs', c: 'user_id', f: 'action_logs_user_id_fkey' },
            { t: 'tasks', c: 'assignee_id', f: 'tasks_assignee_id_fkey' },
            { t: 'tasks', c: 'assigned_by_id', f: 'tasks_assigned_by_id_fkey' },
            { t: 'events', c: 'owner_id', f: 'events_owner_id_fkey' },
            { t: 'users', c: 'created_by', f: 'users_created_by_fkey' }
          ];

          for (const item of cascadeUpdates) {
            await client.query(`ALTER TABLE ${item.t} DROP CONSTRAINT IF EXISTS ${item.f}`);
            await client.query(`ALTER TABLE ${item.t} ADD CONSTRAINT ${item.f} FOREIGN KEY (${item.c}) REFERENCES users(id) ON DELETE CASCADE`);
          }
          console.log('✅ Database Constraints Updated (Cascade Delete Enabled).');
        } catch (migErr) {
          console.warn('ℹ️ Migration warning (safe to ignore if fresh DB):', migErr.message);
        }

        const adminHash = await hashPassword('123');
        await client.query(`
          INSERT INTO users (username, password_hash, name, role, avatar)
          VALUES ('admin', $1, 'مدیر کل (Super Admin)', 'SUPER_ADMIN', 'https://i.pravatar.cc/150?u=1')
          ON CONFLICT (username) DO NOTHING;
        `, [adminHash]);

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

// AUTH: Login
app.post('/api/auth/login', authLimiter, (req, res) => safeQuery(req, res, async () => {
  const { username, password } = req.body;

  if (!username || !password) {
    const err = new Error('VALIDATION_ERROR');
    err.status = 400;
    err.publicMessage = 'نام کاربری و رمز عبور الزامی هستند.';
    throw err;
  }

  const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است.' });
  }

  const row = result.rows[0];
  const hash = row.password_hash;

  const isPasswordValid = await verifyPassword(password, hash);
  const isLegacyPlain = typeof hash === 'string' && !hash.startsWith('scrypt:');

  if (isPasswordValid && isLegacyPlain) {
    const upgradedHash = await hashPassword(password);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [upgradedHash, row.id]);
  }

  if (!isPasswordValid) {
    return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است.' });
  }

  const user = toCamel(row);
  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  await pool.query('INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)', [user.id, token, expiresAt]);

  if (isRedisReady) {
    redisClient.set(token, JSON.stringify(user), { EX: 86400 }).catch(() => {});
  }

  res.json({ user, token });
}));

app.get('/api/auth/me', (req, res) => safeQuery(req, res, async () => {
  await requireAuth(req, res);
  res.json(req.user);
}));

app.post('/api/auth/logout', (req, res) => safeQuery(req, res, async () => {
  await requireAuth(req, res);
  await pool.query('DELETE FROM sessions WHERE token = $1', [req.authToken]);
  if (isRedisReady) redisClient.del(req.authToken).catch(() => {});
  res.json({ success: true });
}));

// Users
app.get('/api/users', (req, res) => safeQuery(req, res, async () => {
  await requireAuth(req, res);
  const r = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
  res.json(toCamel(r.rows));
}));

app.post('/api/users', (req, res) => safeQuery(req, res, async () => {
  await requireAuth(req, res);
  requireRoles(['SUPER_ADMIN', 'ADMIN'])(req);

  const { name, username, password, role, avatar, createdBy } = req.body;
  if (!name || !username || !password || !role) {
    const err = new Error('VALIDATION_ERROR');
    err.status = 400;
    err.publicMessage = 'فیلدهای نام، نام کاربری، رمز عبور و نقش الزامی هستند.';
    throw err;
  }

  const passwordHash = await hashPassword(password);
  const r = await pool.query(
    'INSERT INTO users (name, username, password_hash, role, avatar, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [name, username, passwordHash, role, avatar, createdBy || req.user.id]
  );
  res.json(toCamel(r.rows[0]));
}));

app.put('/api/users/:id', (req, res) => safeQuery(req, res, async () => {
  await requireAuth(req, res);
  assertSelfOrAdmin(req, req.params.id);

  const { id } = req.params;
  const { name, username, role, avatar, password } = req.body;

  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
  const targetIsSelf = req.user.id === id;
  const nextRole = role || req.user.role;

  if (!isAdmin && nextRole !== req.user.role) {
    const err = new Error('FORBIDDEN');
    err.status = 403;
    err.publicMessage = 'امکان تغییر نقش کاربری برای شما وجود ندارد.';
    throw err;
  }

  const safeRole = targetIsSelf && !isAdmin ? req.user.role : nextRole;
  const params = [name, username, safeRole, avatar, id];
  let query = 'UPDATE users SET name=$1, username=$2, role=$3, avatar=$4 WHERE id=$5 RETURNING *';

  if (password) {
    const passwordHash = await hashPassword(password);
    query = 'UPDATE users SET name=$1, username=$2, role=$3, avatar=$4, password_hash=$5 WHERE id=$6 RETURNING *';
    params.splice(4, 1, passwordHash, id);
  }

  const r = await pool.query(query, params);
  res.json(toCamel(r.rows[0]));
}));

app.delete('/api/users/:id', (req, res) => safeQuery(req, res, async () => {
  await requireAuth(req, res);
  requireRoles(['SUPER_ADMIN'])(req);

  if (req.params.id === req.user.id) {
    const err = new Error('VALIDATION_ERROR');
    err.status = 400;
    err.publicMessage = 'نمی‌توانید حساب خودتان را حذف کنید.';
    throw err;
  }

  await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
  res.json({ success: true });
}));

// Tasks
app.get('/api/tasks', (req, res) => safeQuery(req, res, async () => {
  await requireAuth(req, res);
  const r = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
  res.json(toCamel(r.rows));
}));

app.post('/api/tasks', (req, res) => safeQuery(req, res, async () => {
  await requireAuth(req, res);
  const t = req.body;

  const check = await pool.query('SELECT id FROM tasks WHERE id = $1', [t.id]);
  let r;
  if (check.rows.length > 0) {
    r = await pool.query(`UPDATE tasks SET title=$1, description=$2, priority=$3, status=$4, assignee_id=$5, due_date=$6, tags=$7, subtasks=$8, alarms=$9, updates=$10, rich_description=$11 WHERE id=$12 RETURNING *`,
      [t.title, t.description, t.priority, t.status, t.assigneeId, t.dueDate, t.tags, JSON.stringify(t.subtasks), JSON.stringify(t.alarms), JSON.stringify(t.updates), JSON.stringify(t.richDescription), t.id]);
  } else {
    r = await pool.query(`INSERT INTO tasks (id, title, description, priority, status, assignee_id, assigned_by_id, due_date, tags, subtasks, alarms, updates, rich_description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [t.id || undefined, t.title, t.description, t.priority, t.status, t.assigneeId, t.assignedById || req.user.id, t.dueDate, t.tags, JSON.stringify(t.subtasks), JSON.stringify(t.alarms), JSON.stringify(t.updates), JSON.stringify(t.richDescription)]);
  }
  res.json(toCamel(r.rows[0]));
}));

app.delete('/api/tasks/:id', (req, res) => safeQuery(req, res, async () => {
  await requireAuth(req, res);
  await pool.query('DELETE FROM tasks WHERE id=$1', [req.params.id]);
  res.json({ success: true });
}));

// Events
app.get('/api/events', (req, res) => safeQuery(req, res, async () => {
  await requireAuth(req, res);
  const r = await pool.query('SELECT * FROM events');
  res.json(toCamel(r.rows));
}));

app.post('/api/events', (req, res) => safeQuery(req, res, async () => {
  await requireAuth(req, res);
  const e = req.body;
  const check = await pool.query('SELECT id FROM events WHERE id=$1', [e.id]);
  let r;
  if (check.rows.length > 0) {
    r = await pool.query(`UPDATE events SET title=$1, description=$2, start_time=$3, end_time=$4, is_public=$5, location=$6, color=$7, attendees=$8, alarms=$9, event_todos=$10, rich_notes=$11 WHERE id=$12 RETURNING *`,
      [e.title, e.description, e.startTime, e.endTime, e.isPublic, e.location, e.color, e.attendees, JSON.stringify(e.alarms), JSON.stringify(e.eventTodos), JSON.stringify(e.richNotes), e.id]);
  } else {
    r = await pool.query(`INSERT INTO events (id, title, description, start_time, end_time, owner_id, is_public, location, color, attendees, alarms, event_todos, rich_notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [e.id || undefined, e.title, e.description, e.startTime, e.endTime, e.ownerId || req.user.id, e.isPublic, e.location, e.color, e.attendees, JSON.stringify(e.alarms), JSON.stringify(e.eventTodos), JSON.stringify(e.richNotes)]);
  }
  res.json(toCamel(r.rows[0]));
}));

app.delete('/api/events/:id', (req, res) => safeQuery(req, res, async () => {
  await requireAuth(req, res);
  await pool.query('DELETE FROM events WHERE id=$1', [req.params.id]);
  res.json({ success: true });
}));

// Messages
app.get('/api/messages', (req, res) => safeQuery(req, res, async () => {
  await requireAuth(req, res);
  const userId = req.query.userId;
  assertSelfOrAdmin(req, userId);
  const r = await pool.query('SELECT * FROM messages WHERE sender_id=$1 OR receiver_id=$1 ORDER BY timestamp ASC', [userId]);
  res.json(toCamel(r.rows));
}));

app.post('/api/messages', (req, res) => safeQuery(req, res, async () => {
  await requireAuth(req, res);
  const { id, senderId, receiverId, content, isRead, timestamp, attachment, attachmentType, attachmentName } = req.body;
  assertSelfOrAdmin(req, senderId);
  const r = await pool.query(
    'INSERT INTO messages (id, sender_id, receiver_id, content, is_read, timestamp, attachment, attachment_type, attachment_name) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
    [id, senderId, receiverId, content, isRead, timestamp, attachment, attachmentType, attachmentName]
  );
  res.json(toCamel(r.rows[0]));
}));

app.put('/api/messages/:id', (req, res) => safeQuery(req, res, async () => {
  await requireAuth(req, res);
  const { content, isRead } = req.body;

  const check = await pool.query('SELECT * FROM messages WHERE id=$1', [req.params.id]);
  if (!check.rows[0]) {
    const err = new Error('VALIDATION_ERROR');
    err.status = 404;
    err.publicMessage = 'پیام مورد نظر یافت نشد.';
    throw err;
  }

  const message = toCamel(check.rows[0]);
  const canEdit = req.user.id === message.senderId || req.user.id === message.receiverId || ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
  if (!canEdit) {
    const err = new Error('FORBIDDEN');
    err.status = 403;
    err.publicMessage = 'شما اجازه ویرایش این پیام را ندارید.';
    throw err;
  }

  const r = await pool.query(
    'UPDATE messages SET content=COALESCE($1, content), is_read=COALESCE($2, is_read) WHERE id=$3 RETURNING *',
    [content, isRead, req.params.id]
  );
  res.json(toCamel(r.rows[0]));
}));

app.delete('/api/messages/:id', (req, res) => safeQuery(req, res, async () => {
  await requireAuth(req, res);
  const check = await pool.query('SELECT sender_id, receiver_id FROM messages WHERE id=$1', [req.params.id]);

  if (!check.rows[0]) {
    return res.json({ success: true });
  }

  const canDelete = req.user.id === check.rows[0].sender_id || req.user.id === check.rows[0].receiver_id || ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
  if (!canDelete) {
    const err = new Error('FORBIDDEN');
    err.status = 403;
    err.publicMessage = 'شما اجازه حذف این پیام را ندارید.';
    throw err;
  }

  await pool.query('DELETE FROM messages WHERE id=$1', [req.params.id]);
  res.json({ success: true });
}));

app.delete('/api/messages/conversation', (req, res) => safeQuery(req, res, async () => {
  await requireAuth(req, res);
  const { user1, user2 } = req.body;
  assertSelfOrAdmin(req, user1);
  await pool.query('DELETE FROM messages WHERE (sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1)', [user1, user2]);
  res.json({ success: true });
}));

// Notifications
app.get('/api/notifications', (req, res) => safeQuery(req, res, async () => {
  await requireAuth(req, res);
  const userId = req.query.userId;
  assertSelfOrAdmin(req, userId);
  const r = await pool.query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY timestamp DESC', [userId]);
  res.json(toCamel(r.rows));
}));

app.post('/api/notifications', (req, res) => safeQuery(req, res, async () => {
  await requireAuth(req, res);
  const { id, userId, message, isRead, timestamp, type, relatedId } = req.body;

  const userCheck = await pool.query('SELECT id FROM users WHERE id=$1', [userId]);
  if (!userCheck.rows[0]) {
    const err = new Error('VALIDATION_ERROR');
    err.status = 404;
    err.publicMessage = 'کاربر اعلان یافت نشد.';
    throw err;
  }

  const r = await pool.query(
    'INSERT INTO notifications (id, user_id, message, is_read, timestamp, type, related_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
    [id, userId, message, isRead, timestamp, type, relatedId]
  );
  res.json(toCamel(r.rows[0]));
}));

app.put('/api/notifications/:id/read', (req, res) => safeQuery(req, res, async () => {
  await requireAuth(req, res);

  const existing = await pool.query('SELECT * FROM notifications WHERE id=$1', [req.params.id]);
  if (!existing.rows[0]) {
    const err = new Error('VALIDATION_ERROR');
    err.status = 404;
    err.publicMessage = 'اعلان مورد نظر یافت نشد.';
    throw err;
  }

  const currentNotif = toCamel(existing.rows[0]);
  assertSelfOrAdmin(req, currentNotif.userId);

  const r = await pool.query('UPDATE notifications SET is_read=TRUE WHERE id=$1 RETURNING *', [req.params.id]);
  res.json(toCamel(r.rows[0]));
}));

// Logs
app.get('/api/logs', (req, res) => safeQuery(req, res, async () => {
  await requireAuth(req, res);
  requireRoles(['SUPER_ADMIN', 'ADMIN'])(req);
  const r = await pool.query('SELECT * FROM action_logs ORDER BY timestamp DESC LIMIT 100');
  res.json(toCamel(r.rows));
}));

app.post('/api/logs', (req, res) => safeQuery(req, res, async () => {
  await requireAuth(req, res);
  const { id, userId, taskId, action, details, timestamp } = req.body;
  const canWrite = req.user.id === userId || ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
  if (!canWrite) {
    const err = new Error('FORBIDDEN');
    err.status = 403;
    err.publicMessage = 'امکان ثبت این لاگ وجود ندارد.';
    throw err;
  }
  const r = await pool.query(
    'INSERT INTO action_logs (id, user_id, task_id, action, details, timestamp) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [id, userId, taskId, action, details, timestamp]
  );
  res.json(toCamel(r.rows[0]));
}));

// Start Server
app.listen(port, () => {
  console.log(`✅ Backend Server STARTED at http://localhost:${port}`);
  initDb();
});
