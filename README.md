<p align="center">
  <img src="Stylized Logotype for iDesk.png" alt="iDesk Logo" width="400"/>
</p>

<h1 align="center">iDesk - Enterprise IT Helpdesk System</h1>

<p align="center">
  <strong>Modern, Full-Stack IT Helpdesk & Ticketing Solution</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#api-documentation">API Docs</a>
</p>

---

## 📋 Overview

**iDesk** is a comprehensive IT helpdesk and ticketing system designed for enterprise environments. It provides a modern, intuitive interface for managing IT support tickets, knowledge base articles, contract renewals, and team communications with seamless Telegram integration.

## ✨ Features

### 🎫 Ticketing System
- **Multi-channel ticket creation** - Web portal, Telegram bot, or agent-created
- **Priority & SLA management** - Automatic SLA tracking with breach notifications
- **Real-time updates** - WebSocket-powered live ticket updates
- **Rich text messaging** - Support for file attachments and @mentions
- **Internal notes** - Private agent-only communication
- **Ticket assignment** - Manual or automatic agent assignment
- **Status workflow** - TODO → IN_PROGRESS → WAITING → RESOLVED → CLOSED

### 📚 Knowledge Base
- **Article management** - Create, edit, and publish help articles
- **Categories & tags** - Organized content structure
- **Search functionality** - Full-text search across articles
- **View tracking** - Track article popularity and helpfulness
- **Visibility controls** - Public, internal, or private articles

### 🤖 Telegram Bot Integration
- **Create tickets** via Telegram chat
- **View ticket status** and history
- **Receive real-time notifications**
- **Two-way communication** between Telegram and helpdesk
- **Role-based menus** - Different interfaces for Users, Agents, and Admins

### 📊 Dashboard & Reports
- **Real-time statistics** - Ticket volumes, response times, SLA compliance
- **Agent performance** - Resolution rates, avg response time
- **Visual charts** - Interactive dashboards with Recharts
- **Export capabilities** - PDF and Excel report generation

### 📅 Contract Renewal Management
- **PDF contract parsing** - Automatic extraction of contract details
- **Expiry notifications** - 30/60/90 day alerts
- **Acknowledgment tracking** - Track renewal confirmations
- **Manual entry** - Support for non-parseable contracts

### ⚡ Automation Rules
- **Event-driven triggers** - On ticket create, update, SLA breach
- **Automatic actions** - Assignment, priority changes, notifications
- **Configurable rules** - Condition-based automation

### 🔔 Notification System
- **Multi-channel notifications** - In-app, email, Telegram
- **Push notifications** - Browser push support (PWA)
- **Digest emails** - Daily/weekly summary options
- **Read/unread tracking**

### 👥 User Management
- **Role-based access** - Admin, Agent, User roles
- **Department organization**
- **User import** - Bulk import via CSV
- **Avatar management**

## 🛠️ Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| **NestJS 10** | Server framework with modular architecture |
| **TypeORM** | Database ORM with PostgreSQL |
| **Socket.IO** | Real-time WebSocket communication |
| **Passport JWT** | Authentication & authorization |
| **Telegraf** | Telegram bot framework |
| **Bull** | Redis-backed job queues |
| **Swagger** | API documentation |
| **PDFKit** | PDF generation for reports |

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 18** | UI library with TypeScript |
| **Vite** | Fast build tool & dev server |
| **TailwindCSS** | Utility-first styling |
| **Radix UI** | Accessible component primitives |
| **TanStack Query** | Server state management |
| **Zustand** | Client state management |
| **Framer Motion** | Animations |
| **Recharts** | Data visualization |
| **Socket.IO Client** | Real-time updates |
| **React Hook Form + Zod** | Form handling & validation |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| **PostgreSQL** | Primary database |
| **Redis** | Caching & job queues |
| **Docker** | Containerization |

## 🚀 Quick Start

### Prerequisites
- **Node.js** v18 or higher
- **Docker** & Docker Compose
- **Git**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/HitterD/iDesk.git
   cd iDesk
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Start database services**
   ```bash
   # Windows
   deploy_database_docker.bat
   
   # Or using Docker Compose
   docker-compose -f docker-compose.db.yml up -d
   ```

4. **Install dependencies**
   ```bash
   npm run install:all
   ```

5. **Start development servers**
   ```bash
   # Windows one-click
   startup.bat
   
   # Or cross-platform
   npm start
   ```

6. **Access the application**
   - Frontend: http://localhost:4050
   - Backend API: http://localhost:5050
   - Swagger Docs: http://localhost:5050/api

### Default Credentials
After seeding, use these credentials:
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@idesk.com | admin123 |
| Agent | agent@idesk.com | agent123 |
| User | user@idesk.com | user123 |

## 📁 Project Structure

```
iDesk/
├── apps/
│   ├── backend/                 # NestJS Backend
│   │   ├── src/
│   │   │   ├── modules/         # Feature modules
│   │   │   │   ├── auth/        # Authentication & JWT
│   │   │   │   ├── ticketing/   # Ticket management
│   │   │   │   ├── telegram/    # Telegram bot integration
│   │   │   │   ├── knowledge-base/
│   │   │   │   ├── notifications/
│   │   │   │   ├── reports/
│   │   │   │   ├── renewal/     # Contract management
│   │   │   │   ├── automation/  # Rule-based automation
│   │   │   │   ├── users/
│   │   │   │   ├── search/
│   │   │   │   ├── sla-config/
│   │   │   │   └── ...
│   │   │   ├── shared/          # Shared utilities
│   │   │   └── main.ts
│   │   └── package.json
│   │
│   └── frontend/                # React/Vite Frontend
│       ├── src/
│       │   ├── components/      # Reusable UI components
│       │   ├── features/        # Feature modules
│       │   │   ├── ticket-board/
│       │   │   ├── dashboard/
│       │   │   ├── knowledge-base/
│       │   │   ├── reports/
│       │   │   ├── settings/
│       │   │   └── ...
│       │   ├── hooks/           # Custom React hooks
│       │   ├── stores/          # Zustand state stores
│       │   └── lib/             # Utilities & API client
│       └── package.json
│
├── docker-compose.yml           # Full stack deployment
├── docker-compose.db.yml        # Database only
├── startup.bat                  # Windows quick start
├── dev.bat                      # Development utilities
└── package.json                 # Monorepo root
```

## 📖 API Documentation

Interactive API documentation is available via Swagger UI at:
```
http://localhost:5050/api
```

### Key API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /auth/login` | User authentication |
| `GET /tickets` | List tickets with filters |
| `POST /tickets` | Create new ticket |
| `GET /kb/articles` | List knowledge base articles |
| `GET /reports/monthly` | Monthly statistics |
| `POST /telegram/webhook` | Telegram bot webhook |

## ⚙️ Configuration

### Environment Variables

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=idesk_db

# JWT Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=60m  # Role-based: Admin/Agent=3h, User=1h

# Telegram Bot
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_USE_WEBHOOK=false

# Redis (optional)
REDIS_ENABLED=false
REDIS_HOST=localhost
REDIS_PORT=6379

# Email (SMTP)
SMTP_HOST=smtp.example.com
SMTP_USER=your-email
SMTP_PASS=your-password
```

## 🔐 Security Features

- **JWT Authentication** with role-based expiration
- **Password hashing** with bcrypt
- **Rate limiting** on critical endpoints
- **Helmet** for HTTP security headers
- **Input validation** with class-validator
- **File upload validation** with magic bytes check
- **CORS protection**

## 🧪 Testing

```bash
# Backend unit tests
cd apps/backend
npm run test

# Backend e2e tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 📝 Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start both backend & frontend |
| `npm run install:all` | Install all dependencies |
| `startup.bat` | Windows one-click startup |
| `dev.bat` | Development utilities |
| `backup_db.bat` | Backup PostgreSQL database |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is proprietary software. All rights reserved.


