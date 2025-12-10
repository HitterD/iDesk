# 📱 iDesk Mobile Application - Android Development Plan

> **Target Platform:** Android (Native Kotlin)  
> **Integration:** Seamless with iDesk Web Backend (NestJS)  
> **Version:** 1.0.0  
> **Created:** 2025-12-08

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Technology Stack](#2-technology-stack)
3. [Architecture Design](#3-architecture-design)
4. [Module Breakdown](#4-module-breakdown)
5. [API Integration](#5-api-integration)
6. [UI/UX Design Guidelines](#6-uiux-design-guidelines)
7. [Implementation Phases](#7-implementation-phases)
8. [Testing Strategy](#8-testing-strategy)
9. [Deployment Strategy](#9-deployment-strategy)
10. [Claude AI Execution Prompt](#10-claude-ai-execution-prompt)

---

## 1. Executive Summary

### 🎯 Project Objective

Membangun aplikasi mobile Android native untuk **iDesk Enterprise IT Helpdesk System** yang terintegrasi penuh dengan backend NestJS yang sudah ada. Aplikasi ini akan memberikan pengalaman mobile-first untuk semua user roles (User, Agent, Administrator).

### ✅ Key Goals

1. **Full API Integration** - Menggunakan REST API yang sudah tersedia di backend
2. **Real-time Updates** - WebSocket/Socket.IO untuk live ticket updates
3. **Offline-First** - Local database dengan sync mechanism
4. **Push Notifications** - Firebase Cloud Messaging (FCM)
5. **Biometric Auth** - Fingerprint/Face unlock
6. **Role-based UI** - Different layouts untuk User, Agent, Admin

### 📊 Feature Parity Matrix

| Feature | Web | Mobile Android |
|---------|-----|----------------|
| Authentication (JWT) | ✅ | ✅ Planned |
| Create Ticket | ✅ | ✅ Planned |
| View My Tickets | ✅ | ✅ Planned |
| Kanban Board (Agent) | ✅ | ✅ Optimized |
| Chat/Messages | ✅ | ✅ Planned |
| Push Notifications | ✅ PWA | ✅ FCM |
| Knowledge Base | ✅ | ✅ Planned |
| Reports (Admin) | ✅ | 📊 View Only |
| Offline Mode | ❌ | ✅ Planned |
| Biometric Login | ❌ | ✅ Planned |
| Camera Integration | ❌ | ✅ Planned |

---

## 2. Technology Stack

### 2.1 Android Development

| Technology | Purpose | Version |
|------------|---------|---------|
| **Kotlin** | Primary language | 1.9+ |
| **Jetpack Compose** | Modern UI toolkit | 1.5+ |
| **Material Design 3** | Design system | Latest |
| **Coroutines** | Async programming | 1.7+ |
| **Flow** | Reactive streams | Latest |

### 2.2 Architecture Components

| Technology | Purpose |
|------------|---------|
| **Hilt** | Dependency injection |
| **Room Database** | Local SQLite database |
| **DataStore** | Preferences & settings |
| **WorkManager** | Background sync tasks |
| **Navigation Compose** | App navigation |

### 2.3 Networking

| Technology | Purpose |
|------------|---------|
| **Retrofit 2** | REST API client |
| **OkHttp 4** | HTTP client |
| **Moshi/Kotlinx Serialization** | JSON parsing |
| **Socket.IO Client** | Real-time WebSocket |

### 2.4 Additional Libraries

| Technology | Purpose |
|------------|---------|
| **Coil** | Image loading |
| **Firebase** | Push notifications, Analytics, Crashlytics |
| **Accompanist** | Compose utilities |
| **BiometricPrompt** | Fingerprint/Face authentication |
| **CameraX** | Camera integration |
| **ExoPlayer** | Video playback |

---

## 3. Architecture Design

### 3.1 Clean Architecture Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│   │  Screens    │  │ ViewModels  │  │  UI Components      │ │
│   │  (Compose)  │  │  (State)    │  │  (Composables)      │ │
│   └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                      DOMAIN LAYER                            │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│   │  Use Cases  │  │  Entities   │  │   Repositories      │ │
│   │  (Business) │  │  (Models)   │  │   (Interfaces)      │ │
│   └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                       DATA LAYER                             │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│   │  Remote     │  │   Local     │  │  Repository         │ │
│   │  (Retrofit) │  │   (Room)    │  │  Implementations    │ │
│   └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Project Structure

```
app/
├── src/main/
│   ├── java/com/idesk/mobile/
│   │   ├── core/
│   │   │   ├── di/                    # Hilt modules
│   │   │   ├── network/               # Retrofit, interceptors
│   │   │   ├── database/              # Room database
│   │   │   ├── preferences/           # DataStore
│   │   │   ├── utils/                 # Extensions, helpers
│   │   │   └── security/              # Encryption, biometrics
│   │   │
│   │   ├── domain/
│   │   │   ├── model/                 # Domain entities
│   │   │   ├── repository/            # Repository interfaces
│   │   │   └── usecase/               # Business logic
│   │   │
│   │   ├── data/
│   │   │   ├── remote/
│   │   │   │   ├── api/               # API interfaces
│   │   │   │   ├── dto/               # Data Transfer Objects
│   │   │   │   └── mapper/            # DTO to Entity mappers
│   │   │   ├── local/
│   │   │   │   ├── dao/               # Room DAOs
│   │   │   │   └── entity/            # Room entities
│   │   │   └── repository/            # Repository implementations
│   │   │
│   │   ├── ui/
│   │   │   ├── theme/                 # Material Theme
│   │   │   ├── components/            # Reusable composables
│   │   │   ├── navigation/            # NavHost, routes
│   │   │   └── screens/
│   │   │       ├── auth/
│   │   │       ├── ticket/
│   │   │       ├── dashboard/
│   │   │       ├── knowledgebase/
│   │   │       ├── notifications/
│   │   │       ├── profile/
│   │   │       └── settings/
│   │   │
│   │   ├── service/
│   │   │   ├── FCMService.kt          # Push notifications
│   │   │   ├── SyncWorker.kt          # Background sync
│   │   │   └── SocketService.kt       # WebSocket service
│   │   │
│   │   └── IDeskApplication.kt
│   │
│   └── res/
│       ├── drawable/
│       ├── values/
│       │   ├── colors.xml
│       │   ├── strings.xml
│       │   └── themes.xml
│       └── ...
└── build.gradle.kts
```

---

## 4. Module Breakdown

### 4.1 🔐 Auth Module

**Features:**
- Login dengan email/password
- Biometric authentication (Fingerprint/Face)
- JWT token management dengan automatic refresh
- Remember me functionality
- Logout dengan token invalidation

**Screens:**
1. `LoginScreen` - Email/password form + biometric option
2. `RegisterScreen` - User registration (if applicable)
3. `ForgotPasswordScreen` - Password reset

**API Integration:**
```kotlin
interface AuthApi {
    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): Response<AuthResponse>
    
    @POST("auth/refresh")
    suspend fun refreshToken(@Body request: RefreshTokenRequest): Response<AuthResponse>
    
    @POST("auth/logout")
    suspend fun logout(): Response<Unit>
}
```

### 4.2 🎫 Ticket Module

**Features:**
- Create ticket dengan attachments (camera/gallery)
- View my tickets (User)
- Kanban board (Agent/Admin) - swipe gestures
- Ticket detail dengan message thread
- Send messages dengan attachments
- Real-time status updates

**Screens:**
1. `MyTicketsScreen` - List tickets dengan pull-to-refresh
2. `TicketDetailScreen` - Full ticket view dengan chat
3. `CreateTicketScreen` - Form dengan category selection
4. `KanbanBoardScreen` - Draggable columns (Agent)
5. `TicketSearchScreen` - Advanced search

**API Integration:**
```kotlin
interface TicketApi {
    @GET("tickets")
    suspend fun getTickets(@QueryMap filters: Map<String, String>): Response<PaginatedTickets>
    
    @GET("tickets/{id}")
    suspend fun getTicketById(@Path("id") id: String): Response<TicketDetail>
    
    @POST("tickets")
    suspend fun createTicket(@Body request: CreateTicketRequest): Response<Ticket>
    
    @PUT("tickets/{id}")
    suspend fun updateTicket(@Path("id") id: String, @Body request: UpdateTicketRequest): Response<Ticket>
    
    @POST("tickets/{id}/messages")
    suspend fun sendMessage(@Path("id") id: String, @Body request: MessageRequest): Response<TicketMessage>
    
    @Multipart
    @POST("uploads")
    suspend fun uploadFile(@Part file: MultipartBody.Part): Response<UploadResponse>
}
```

### 4.3 📊 Dashboard Module

**Features:**
- Statistics overview (cards)
- Recent tickets
- Quick actions (create ticket, search)
- Agent performance (Agent/Admin)
- SLA status indicators

**Screens:**
1. `DashboardScreen` - Main dashboard widgets
2. `StatsDetailScreen` - Detailed statistics

### 4.4 📚 Knowledge Base Module

**Features:**
- Browse articles by category
- Search articles
- Offline reading (cached articles)
- Article feedback

**Screens:**
1. `KnowledgeBaseScreen` - Category grid
2. `ArticleListScreen` - Articles in category
3. `ArticleDetailScreen` - Full article view

### 4.5 🔔 Notification Module

**Features:**
- Push notification handling (FCM)
- In-app notification center
- Notification preferences
- Mark as read/unread

**Screens:**
1. `NotificationCenterScreen` - All notifications
2. `NotificationSettingsScreen` - Preferences

### 4.6 👤 Profile Module

**Features:**
- View/edit profile
- Change password
- Avatar upload
- Link Telegram account
- App settings

**Screens:**
1. `ProfileScreen` - User profile
2. `EditProfileScreen` - Edit form
3. `SettingsScreen` - App preferences

---

## 5. API Integration

### 5.1 Backend API Endpoints

Menggunakan API endpoints yang sudah tersedia di backend NestJS:

| Module | Base URL | Auth Required |
|--------|----------|---------------|
| Auth | `/auth/*` | ❌ (login only) |
| Users | `/users/*` | ✅ |
| Tickets | `/tickets/*` | ✅ |
| Messages | `/tickets/:id/messages` | ✅ |
| Knowledge Base | `/kb/*` | ✅ |
| Notifications | `/notifications/*` | ✅ |
| Uploads | `/uploads/*` | ✅ |
| Search | `/search/*` | ✅ |

### 5.2 WebSocket Events (Socket.IO)

```kotlin
// Listen events
socket.on("ticket:updated") { ... }
socket.on("ticket:new_message") { ... }
socket.on("notification:new") { ... }

// Emit events
socket.emit("join:ticket", ticketId)
socket.emit("leave:ticket", ticketId)
```

### 5.3 Authentication Flow

```
┌─────────────┐        ┌─────────────┐        ┌─────────────┐
│   Mobile    │        │   Backend   │        │   Redis     │
└──────┬──────┘        └──────┬──────┘        └──────┬──────┘
       │                      │                      │
       │  POST /auth/login    │                      │
       │─────────────────────>│                      │
       │                      │                      │
       │  { accessToken,      │                      │
       │    refreshToken }    │                      │
       │<─────────────────────│                      │
       │                      │                      │
       │  Store tokens        │                      │
       │  (EncryptedSharedPref)                      │
       │                      │                      │
       │  GET /tickets        │                      │
       │  Auth: Bearer token  │                      │
       │─────────────────────>│                      │
       │                      │  Validate JWT        │
       │                      │─────────────────────>│
       │  200 OK              │                      │
       │<─────────────────────│                      │
```

---

## 6. UI/UX Design Guidelines

### 6.1 Design System

**Color Palette (Matching Web):**
```kotlin
// Light Theme
val Primary = Color(0xFF0066FF)        // Blue
val Secondary = Color(0xFF00C853)      // Green
val Background = Color(0xFFF5F7FA)     // Light gray
val Surface = Color(0xFFFFFFFF)        // White
val Error = Color(0xFFFF5252)          // Red

// Dark Theme
val PrimaryDark = Color(0xFF4D94FF)    // Light blue
val BackgroundDark = Color(0xFF121212) // Dark
val SurfaceDark = Color(0xFF1E1E1E)    // Dark surface

// Status Colors
val StatusTodo = Color(0xFF9E9E9E)     // Gray
val StatusInProgress = Color(0xFF2196F3) // Blue
val StatusWaiting = Color(0xFFFFC107)  // Amber
val StatusResolved = Color(0xFF4CAF50) // Green
val StatusClosed = Color(0xFF607D8B)   // Blue Gray
```

**Typography:**
```kotlin
val Typography = Typography(
    displayLarge = TextStyle(
        fontFamily = FontFamily(Font(R.font.inter_bold)),
        fontSize = 32.sp
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily(Font(R.font.inter_semibold)),
        fontSize = 22.sp
    ),
    bodyLarge = TextStyle(
        fontFamily = FontFamily(Font(R.font.inter_regular)),
        fontSize = 16.sp
    ),
    // ...
)
```

### 6.2 Component Library

**Reusable Components:**
- `IDeskButton` - Primary, secondary, outline variants
- `IDeskTextField` - With validation states
- `IDeskCard` - Elevated cards with consistent styling
- `TicketStatusChip` - Color-coded status chips
- `PriorityBadge` - Priority indicators
- `UserAvatar` - Profile avatars with initials fallback
- `LoadingOverlay` - Full-screen loading
- `ErrorDialog` - Standardized error handling
- `EmptyState` - Ilustrasi untuk empty lists
- `SwipeableCard` - Gesture-enabled cards

### 6.3 Navigation Pattern

```kotlin
sealed class Screen(val route: String) {
    // Auth
    object Login : Screen("login")
    object Register : Screen("register")
    
    // Main
    object Dashboard : Screen("dashboard")
    object Tickets : Screen("tickets")
    object TicketDetail : Screen("tickets/{ticketId}")
    object CreateTicket : Screen("tickets/create")
    object KnowledgeBase : Screen("knowledge-base")
    object Notifications : Screen("notifications")
    object Profile : Screen("profile")
    object Settings : Screen("settings")
}
```

---

## 7. Implementation Phases

### 📋 Phase 1: Foundation (Week 1-2)

**Fokus:** Setup project, authentication, basic navigation

```
Week 1:
├── Project Setup
│   ├── Create Android project dengan Kotlin & Compose
│   ├── Setup Hilt DI
│   ├── Configure Retrofit + OkHttp
│   ├── Setup Room Database
│   └── Implement theme & design system
│
└── Authentication Module
    ├── Login screen UI
    ├── Auth API integration
    ├── Token storage (EncryptedSharedPreferences)
    ├── Auth interceptor for auto-attach token
    └── Biometric authentication setup

Week 2:
├── Navigation Setup
│   ├── Bottom navigation bar
│   ├── Nav graph configuration
│   └── Deep linking support
│
└── Base Components
    ├── Loading states
    ├── Error handling
    ├── Pull-to-refresh
    └── Reusable UI components
```

**Deliverables:**
- [ ] Working login flow
- [ ] Biometric login option
- [ ] Basic navigation structure
- [ ] Theme implementation

---

### 🎫 Phase 2: Ticket Core (Week 3-4)

**Fokus:** Ticket listing, creation, dan detail view

```
Week 3:
├── My Tickets Screen
│   ├── Ticket list dengan pagination
│   ├── Filter & sort options
│   ├── Pull-to-refresh
│   ├── Search functionality
│   └── Status filtering tabs
│
└── Ticket Detail Screen
    ├── Ticket info header
    ├── Message thread (chat UI)
    ├── Send message functionality
    └── Status change (Agent)

Week 4:
├── Create Ticket Screen
│   ├── Multi-step form
│   ├── Category selection
│   ├── Priority selection
│   ├── File attachments (camera/gallery)
│   └── Form validation
│
└── Offline Support
    ├── Room caching for tickets
    ├── WorkManager sync
    └── Offline indicator
```

**Deliverables:**
- [ ] Complete ticket CRUD
- [ ] Message sending dengan attachments
- [ ] Offline caching
- [ ] Camera integration

---

### 📊 Phase 3: Dashboard & KB (Week 5-6)

**Fokus:** Dashboard widgets, Knowledge Base

```
Week 5:
├── Dashboard Screen
│   ├── Stats cards (total, open, resolved)
│   ├── Recent tickets widget
│   ├── Quick actions
│   ├── SLA status (Agent/Admin)
│   └── Charts (simple pie/bar)
│
└── Knowledge Base
    ├── Category browsing
    ├── Article list
    ├── Article detail view
    └── Offline article caching

Week 6:
├── Search Module
│   ├── Global search
│   ├── Recent searches
│   └── Search suggestions
│
└── Agent Features
    ├── Kanban board (swipe between columns)
    ├── Ticket assignment
    ├── Bulk status change
    └── Internal notes
```

**Deliverables:**
- [ ] Functional dashboard
- [ ] Knowledge base browsing
- [ ] Agent kanban board
- [ ] Search functionality

---

### 🔔 Phase 4: Notifications & Polish (Week 7-8)

**Fokus:** Push notifications, real-time updates, polish

```
Week 7:
├── Push Notifications
│   ├── Firebase setup
│   ├── FCM token registration
│   ├── Notification handling (foreground/background)
│   ├── Deep linking from notifications
│   └── Notification preferences
│
└── Real-time Updates
    ├── Socket.IO integration
    ├── Live ticket updates
    ├── Typing indicators (chat)
    └── Online/offline status

Week 8:
├── Profile & Settings
│   ├── Profile view/edit
│   ├── Avatar upload
│   ├── Change password
│   ├── App settings (theme, notifications)
│   └── Logout
│
└── Polish & Optimization
    ├── Performance optimization
    ├── Memory management
    ├── Accessibility improvements
    ├── Crash reporting (Crashlytics)
    └── Analytics integration
```

**Deliverables:**
- [ ] FCM push notifications
- [ ] Real-time updates via WebSocket
- [ ] Complete profile management
- [ ] Production-ready app

---

## 8. Testing Strategy

### 8.1 Unit Tests

```kotlin
// Example: TicketRepository Test
@Test
fun `getTickets should return cached data when offline`() = runTest {
    // Given
    coEvery { networkChecker.isConnected() } returns false
    coEvery { ticketDao.getAllTickets() } returns mockTickets
    
    // When
    val result = repository.getTickets()
    
    // Then
    assertThat(result).isEqualTo(mockTickets)
    coVerify { ticketDao.getAllTickets() }
    coVerify(exactly = 0) { ticketApi.getTickets(any()) }
}
```

### 8.2 UI Tests

```kotlin
// Example: Login Screen Test
@Test
fun loginWithValidCredentials_navigatesToDashboard() {
    composeTestRule.setContent {
        IDeskTheme {
            LoginScreen(onLoginSuccess = { /* verify navigation */ })
        }
    }
    
    composeTestRule.onNodeWithTag("email_input").performTextInput("test@example.com")
    composeTestRule.onNodeWithTag("password_input").performTextInput("password123")
    composeTestRule.onNodeWithTag("login_button").performClick()
    
    // Verify navigation
}
```

### 8.3 Integration Tests

- API integration tests dengan MockWebServer
- Database tests dengan in-memory Room
- End-to-end flow tests

---

## 9. Deployment Strategy

### 9.1 Build Variants

```kotlin
android {
    buildTypes {
        debug {
            buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:5050/\"")
            buildConfigField("Boolean", "ENABLE_LOGGING", "true")
        }
        release {
            buildConfigField("String", "API_BASE_URL", "\"https://api.idesk.com/\"")
            buildConfigField("Boolean", "ENABLE_LOGGING", "false")
            isMinifyEnabled = true
            proguardFiles(...)
        }
    }
    
    flavorDimensions += "environment"
    productFlavors {
        create("development") {
            applicationIdSuffix = ".dev"
            versionNameSuffix = "-dev"
        }
        create("staging") {
            applicationIdSuffix = ".staging"
            versionNameSuffix = "-staging"
        }
        create("production") {
            // Default production config
        }
    }
}
```

### 9.2 Release Checklist

- [ ] ProGuard rules configured
- [ ] App signing setup
- [ ] Release notes prepared
- [ ] Crashlytics enabled
- [ ] Analytics configured
- [ ] Play Store listing prepared
- [ ] Privacy policy linked
- [ ] Screenshots captured

---

## 10. Claude AI Execution Prompt

Di bawah ini adalah **prompt teroptimasi** untuk digunakan dengan Claude AI untuk mengeksekusi pembuatan aplikasi Android:

---

### 🎯 OPTIMIZED EXECUTION PROMPT

```markdown
# CONTEXT & ROLE

You are a Senior Android Developer with 10+ years of experience in native Android development. You specialize in:
- Modern Android development with Kotlin & Jetpack Compose
- Clean Architecture & MVVM patterns
- API integration & offline-first design
- Enterprise mobile application development

# PROJECT OVERVIEW

You are building **iDesk Mobile** - an Android application for the iDesk Enterprise IT Helpdesk System. This app must integrate seamlessly with an existing NestJS backend API.

## Existing Backend Context

The backend is already running and provides:
- REST API at `http://localhost:5050` (or production URL)
- JWT Authentication (access + refresh tokens)
- WebSocket via Socket.IO for real-time updates
- 15+ API modules: auth, users, tickets, messages, knowledge-base, notifications, etc.

## Key API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/login` | POST | Login dengan email/password |
| `/auth/refresh` | POST | Refresh access token |
| `/tickets` | GET | List tickets (paginated, filterable) |
| `/tickets` | POST | Create new ticket |
| `/tickets/:id` | GET | Get ticket detail |
| `/tickets/:id/messages` | GET | Get ticket messages |
| `/tickets/:id/messages` | POST | Send message |
| `/kb/articles` | GET | List knowledge base articles |
| `/notifications` | GET | Get notifications |
| `/users/me` | GET | Get current user profile |
| `/uploads` | POST | Upload file (multipart) |

# TECHNICAL REQUIREMENTS

## Technology Stack (MANDATORY)

- **Language:** Kotlin 1.9+
- **UI Framework:** Jetpack Compose with Material Design 3
- **Architecture:** Clean Architecture (Domain, Data, Presentation layers)
- **DI:** Hilt (Dagger)
- **Networking:** Retrofit 2 + OkHttp 4
- **Local DB:** Room Database
- **State Management:** StateFlow + Compose State
- **Navigation:** Navigation Compose
- **Async:** Coroutines + Flow
- **Image Loading:** Coil
- **Push Notifications:** Firebase Cloud Messaging
- **Serialization:** Kotlinx Serialization or Moshi

## Project Structure

Create this exact package structure:
```
com.idesk.mobile/
├── core/
│   ├── di/                 # Hilt modules
│   ├── network/            # Retrofit setup, interceptors
│   ├── database/           # Room database
│   ├── preferences/        # DataStore
│   └── utils/              # Extensions, helpers
├── domain/
│   ├── model/              # Domain entities
│   ├── repository/         # Repository interfaces
│   └── usecase/            # Business logic use cases
├── data/
│   ├── remote/
│   │   ├── api/            # Retrofit interfaces
│   │   ├── dto/            # API DTOs
│   │   └── mapper/         # DTO to Domain mappers
│   ├── local/
│   │   ├── dao/            # Room DAOs
│   │   └── entity/         # Room entities
│   └── repository/         # Repository implementations
├── ui/
│   ├── theme/              # Colors, Typography, Theme
│   ├── components/         # Reusable composables
│   ├── navigation/         # NavHost, Routes
│   └── screens/
│       ├── auth/
│       ├── dashboard/
│       ├── ticket/
│       ├── knowledgebase/
│       ├── notifications/
│       └── profile/
└── service/
    ├── FCMService.kt
    └── SyncWorker.kt
```

## User Roles

Implement role-based UI for:
1. **USER** - Can create tickets, view own tickets, browse KB
2. **AGENT** - All USER features + kanban board, assign tickets, internal notes
3. **ADMIN** - All features + admin dashboard, reports

# IMPLEMENTATION INSTRUCTIONS

## Phase 1: Setup & Auth (Priority: HIGH)

1. Create new Android project dengan nama `iDesk Mobile`
2. Setup Gradle dengan semua dependencies
3. Implement Hilt DI configuration
4. Create Retrofit setup dengan:
   - Base URL configuration
   - Auth interceptor (auto-attach JWT token)
   - Token refresh interceptor
   - Logging interceptor (debug only)
5. Implement Login Screen dengan:
   - Email/password form
   - Form validation (Zod-like validation)
   - Loading state handling
   - Error handling dengan snackbar
   - Token storage (EncryptedSharedPreferences)
6. Implement biometric authentication (optional login)
7. Setup bottom navigation: Dashboard, Tickets, KB, Notifications, Profile

## Phase 2: Tickets (Priority: HIGH)

1. Implement My Tickets Screen:
   - LazyColumn dengan pagination
   - Status filter tabs (All, Open, In Progress, Resolved)
   - Pull-to-refresh
   - Empty state illustration
   - Click to open detail
2. Implement Ticket Detail Screen:
   - Ticket info header (status chip, priority badge)
   - Message list (chat-like UI)
   - Message input dengan attachment button
   - Real-time updates via Socket.IO
3. Implement Create Ticket Screen:
   - Multi-step form
   - Category dropdown
   - Priority selection
   - Description editor
   - File attachment (camera/gallery picker)
4. Implement Kanban Board (Agent/Admin):
   - Horizontal pager dengan columns (TODO, IN_PROGRESS, etc)
   - Swipe gestures untuk change status
   - Drag & drop (bonus)

## Phase 3: Other Modules

1. Dashboard dengan stats cards
2. Knowledge Base dengan category navigation
3. Notification center dengan FCM integration
4. Profile & Settings screens

# DESIGN SPECIFICATIONS

## Color Palette

```kotlin
// Primary Blue
val Primary = Color(0xFF0066FF)
val PrimaryVariant = Color(0xFF0052CC)
val OnPrimary = Color.White

// Background
val Background = Color(0xFFF5F7FA)
val Surface = Color.White
val OnBackground = Color(0xFF1A1A2E)

// Status Colors
val StatusTodo = Color(0xFF9E9E9E)
val StatusInProgress = Color(0xFF2196F3)
val StatusWaiting = Color(0xFFFFC107)
val StatusResolved = Color(0xFF4CAF50)
val StatusClosed = Color(0xFF607D8B)

// Priority Colors
val PriorityLow = Color(0xFF4CAF50)
val PriorityMedium = Color(0xFFFFC107)
val PriorityHigh = Color(0xFFFF9800)
val PriorityCritical = Color(0xFFFF5252)
```

## UI Patterns

- Use Material 3 components (M3)
- Cards with 8dp corner radius
- Consistent 16dp horizontal padding
- Pull-to-refresh on all lists
- Skeleton loading (shimmer effect)
- Error states dengan retry button
- Empty states dengan illustrations

# OUTPUT EXPECTATIONS

When implementing each feature:
1. Create all necessary files following the package structure
2. Write clean, documented Kotlin code
3. Follow Kotlin coding conventions
4. Implement proper error handling
5. Add TODO comments for items needing attention
6. Include basic unit tests for ViewModels

# EXECUTION ORDER

Execute in this order:
1. Project setup & Gradle configuration
2. Core module (DI, Network, Database)
3. Auth module (Login flow)
4. Ticket module (CRUD operations)
5. Dashboard module
6. Knowledge Base module
7. Notifications module
8. Profile module
9. Testing & polish

Begin with Phase 1: Create the Android project structure and implement the authentication flow.
```

---

### 🔑 Key Improvements Applied

**Techniques Applied:**
- ✅ **Role Assignment** - Senior Android Developer persona
- ✅ **Context Layering** - Backend API context, existing system info
- ✅ **Constraint-based** - Specific tech stack requirements
- ✅ **Chain-of-thought** - Phased implementation approach
- ✅ **Task Decomposition** - Clear phases dengan priorities
- ✅ **Output Specs** - Exact project structure, color codes

**Platform Optimization (Claude):**
- Longer context untuk comprehensive requirements
- Reasoning frameworks dengan step-by-step phases
- Technical precision dengan code examples

---

## Appendix: API Response Examples

### Login Response

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "USER",
    "department": "IT",
    "avatarUrl": "/uploads/avatars/xxx.jpg"
  }
}
```

### Ticket List Response

```json
{
  "data": [
    {
      "id": "uuid",
      "ticketNo": "TKT-20251208-001",
      "title": "Email not working",
      "status": "IN_PROGRESS",
      "priority": "HIGH",
      "category": "Email",
      "createdAt": "2025-12-08T10:00:00Z",
      "requester": { "id": "uuid", "name": "John", "avatarUrl": "..." },
      "assignee": { "id": "uuid", "name": "Agent", "avatarUrl": "..." },
      "slaDeadline": "2025-12-08T14:00:00Z",
      "isOverdue": false
    }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "perPage": 20,
    "totalPages": 5
  }
}
```

### Socket.IO Events

```typescript
// Server → Client
"ticket:updated" → { ticketId, updates }
"ticket:new_message" → { ticketId, message }
"notification:new" → { notification }

// Client → Server
"join:ticket" → ticketId
"leave:ticket" → ticketId
"typing:start" → ticketId
"typing:stop" → ticketId
```

---

*Document created for iDesk Mobile Android Development*  
*Last Updated: 2025-12-08*
