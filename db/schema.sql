
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users Table
CREATE TABLE users (
                       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                       username VARCHAR(50) UNIQUE NOT NULL,
                       password_hash VARCHAR(255) NOT NULL,
                       name VARCHAR(100) NOT NULL, -- Changed from full_name to match frontend 'name'
                       role VARCHAR(20) CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'USER')),
                       avatar TEXT, -- Changed from avatar_url
                       created_by UUID REFERENCES users(id),
                       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions Table (NEW)
CREATE TABLE sessions (
                          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                          token VARCHAR(255) UNIQUE NOT NULL,
                          expires_at TIMESTAMP NOT NULL,
                          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tasks Table
CREATE TABLE tasks (
                       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                       title VARCHAR(200) NOT NULL,
                       description TEXT,
                       rich_description JSONB DEFAULT '[]', -- NEW COLUMN
                       priority VARCHAR(10) CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
                       status VARCHAR(20) CHECK (status IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE')),
                       assignee_id UUID REFERENCES users(id),
                       assigned_by_id UUID REFERENCES users(id),
                       due_date TIMESTAMP,
                       tags TEXT[], -- PostgreSQL Array for tags
                       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subtasks (JSONB is better for nested arrays in simple apps, but relational is stricter. Using JSONB for simplicity/flexibility with frontend types)
ALTER TABLE tasks ADD COLUMN subtasks JSONB DEFAULT '[]';
ALTER TABLE tasks ADD COLUMN alarms JSONB DEFAULT '[]';
ALTER TABLE tasks ADD COLUMN updates JSONB DEFAULT '[]';

-- Calendar Events
CREATE TABLE events (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        title VARCHAR(200) NOT NULL,
                        description TEXT,
                        start_time TIMESTAMP NOT NULL,
                        end_time TIMESTAMP NOT NULL,
                        owner_id UUID REFERENCES users(id),
                        is_public BOOLEAN DEFAULT FALSE,
                        location VARCHAR(200),
                        color VARCHAR(20),
                        attendees TEXT[], -- Array of User IDs
                        alarms JSONB DEFAULT '[]',
                        event_todos JSONB DEFAULT '[]',
                        rich_notes JSONB DEFAULT '[]',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages
CREATE TABLE messages (
                          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                          sender_id UUID REFERENCES users(id),
                          receiver_id UUID REFERENCES users(id),
                          content TEXT NOT NULL,
                          is_read BOOLEAN DEFAULT FALSE,
                          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- match frontend 'timestamp' field
);

-- Notifications
CREATE TABLE notifications (
                               id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                               user_id UUID REFERENCES users(id),
                               message TEXT NOT NULL,
                               is_read BOOLEAN DEFAULT FALSE,
                               timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Logs
CREATE TABLE action_logs (
                             id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                             user_id UUID REFERENCES users(id),
                             task_id UUID,
                             action VARCHAR(50), -- match frontend 'action'
                             details TEXT,
                             timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed Initial Data
INSERT INTO users (username, password_hash, name, role, avatar)
VALUES
    ('admin', '123', 'مدیر کل (Super Admin)', 'SUPER_ADMIN', 'https://i.pravatar.cc/150?u=1'),
    ('manager', '123', 'مدیر بخش (Admin)', 'ADMIN', 'https://i.pravatar.cc/150?u=2'),
    ('user', '123', 'کارمند نمونه', 'USER', 'https://i.pravatar.cc/150?u=3')
    ON CONFLICT (username) DO NOTHING;
