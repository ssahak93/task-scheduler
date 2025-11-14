# Task Scheduling & Notification Platform

A task scheduling tool with user availability tracking, overlap validation, and real-time notifications.

## Tech Stack

**Backend**: NestJS, TypeORM, MySQL, MongoDB, Redis, Bull, JWT, Socket.IO, MinIO  
**Frontend**: Vue.js 3, TypeScript, Pinia, Vite, Socket.IO Client

## Quick Start

### Using Docker

```bash
docker-compose up -d
```

**Access:**
- Frontend: `http://localhost`
- Backend API: `http://localhost/api`

### Local Development

**Backend:**
```bash
cd backend
npm install
npm run migration:run
npm run seed
npm run start:dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## User Credentials

### Admin User
- **Email**: `admin@task.com`
- **Password**: `admin123`
- **Role**: Admin

### Manager User
- **Email**: `manager@task.com`
- **Password**: `manager123`
- **Role**: Manager

### Regular Users
- **Email**: `user1@task.com` | **Password**: `user123` | **Name**: John Doe
- **Email**: `user2@task.com` | **Password**: `user123` | **Name**: Jane Smith
- **Email**: `user3@task.com` | **Password**: `user123` | **Name**: Bob Johnson

**Note**: Passwords can be customized via environment variables (`ADMIN_PASSWORD`, `MANAGER_PASSWORD`, `USER_PASSWORD`).

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login

### Tasks
- `GET /api/tasks` - List tasks (query params: `statusId`, `assignedUserId`, `search`)
- `GET /api/tasks/:id` - Get single task
- `POST /api/tasks` - Create task
- `PATCH /api/tasks/:id` - Update task
- `PATCH /api/tasks/:id/reassign` - Reassign task
- `DELETE /api/tasks/:id` - Delete task

### Notifications
- `GET /api/notifications` - Get notifications (query param: `unread=true`)
- `PATCH /api/notifications/:id/read` - Mark as read
- `PATCH /api/notifications/read-all` - Mark all as read
- **WebSocket**: Real-time notifications via Socket.IO

### Chat
- `GET /api/chats` - List user chats
- `GET /api/chats/:id` - Get chat details
- `GET /api/chats/:id/messages` - Get messages (query params: `limit`, `offset`)
- `POST /api/chats/direct/:userId` - Create/find direct chat
- `POST /api/chats/group` - Create group chat
- `POST /api/chats/:id/messages` - Send message (supports file uploads)
- `POST /api/chats/:id/read` - Mark messages as read
- `POST /api/storage/upload` - Upload file to MinIO
- **WebSocket**: Real-time messaging, typing indicators via Socket.IO (`/chat` namespace)

### Others
- `GET /api/users` - List users
- `GET /api/statuses` - List statuses

All endpoints except `/api/auth/login` require JWT authentication.

## Features

- Task Management: Full CRUD with validation
- Overlap Prevention: Automatic checking to prevent overlapping tasks
- Real-time Notifications: Push notifications via Socket.IO
- Background Processing: Asynchronous notification processing via Bull queue
- Search & Filter: Search by title/description, filter by status/user
- Dashboard: List and kanban views
- Chat System: Real-time messaging with direct and group chats
  - File uploads (images, documents, audio) via MinIO
  - Typing indicators
  - Unread message badges
  - Message reactions
  - Read receipts
