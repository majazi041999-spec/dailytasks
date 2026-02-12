
export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE'
}

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'USER';

export interface User {
  id: string;
  username: string;
  name: string;
  avatar: string;
  role: UserRole;
  createdBy?: string;
}

export interface SubTask {
  id: string;
  title: string;
  isCompleted: boolean;
}

export interface Alarm {
  id: string;
  offsetMinutes: number; // 0 = At time, 60 = 1 hour before, 1440 = 1 day before
  isFired: boolean;
}

export interface TaskUpdate {
  id: string;
  userId: string;
  content: string; // Text description
  timestamp: string;
  // Enhanced Attachment Support
  attachment?: string; // Base64
  attachmentName?: string;
  attachmentType?: 'image' | 'file';
  progressValue?: number; // Snapshot of progress % at this update
}

export type RichBlockType = 'text' | 'image' | 'list' | 'file';

export interface RichBlock {
  id: string;
  type: RichBlockType;
  content: string; // For text/file/image data (base64)
  meta?: string; // Filename for files
}

export interface Task {
  id: string;
  title: string;
  description: string; // Keep for simple summary/backward compat
  richDescription?: RichBlock[]; // NEW: Advanced editor content
  priority: Priority;
  status: TaskStatus;
  assigneeId: string;
  assignedById: string;
  dueDate: string; // ISO
  createdAt: string;
  tags: string[];
  subtasks?: SubTask[];
  alarms?: Alarm[];
  updates?: TaskUpdate[];
}

export interface ActionLog {
  id: string;
  taskId?: string;
  userId: string;
  action: 'CREATED' | 'UPDATED' | 'COMPLETED' | 'DELETED' | 'MESSAGE' | 'EVENT' | 'LOGIN';
  timestamp: string;
  details: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  isRead: boolean;
  // New Attachment Fields
  attachment?: string; // Base64 data string
  attachmentType?: 'image' | 'file';
  attachmentName?: string;
}

export interface EventTodo {
  id: string;
  title: string;
  isCompleted: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  meetingSummary?: string;
  startTime: string; // ISO
  endTime: string; // ISO
  ownerId: string;
  isPublic: boolean;
  location?: string;
  attendees?: string[]; // User IDs
  color?: string; // Hex or Tailwind class
  link?: string;
  alarms?: Alarm[];
  richNotes?: RichBlock[];
  eventTodos?: EventTodo[];
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  isRead: boolean;
  timestamp: string;
  type?: 'ALARM' | 'SYSTEM' | 'TASK_ASSIGNMENT';
  relatedId?: string;
}

export type TaskMap = Record<TaskStatus, Task[]>;
