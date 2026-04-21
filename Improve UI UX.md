# 🎨 iDesk UI/UX Improvement Plan

> Dokumen ini berisi analisis komprehensif dan rekomendasi perbaikan UI/UX untuk seluruh halaman aplikasi iDesk.

## 🚀 Progress Overview

| Phase | Status | Completion Date |
|-------|--------|-----------------|
| Phase 1: Urgent Animations & Calendar | ✅ Complete | Dec 8, 2025 |
| Phase 2: Dropdown & Global Animations | ✅ Complete | Dec 8, 2025 |
| Phase 3: Per-Page Improvements | ✅ Complete | Dec 8, 2025 |
| Phase 4: Testing & Polish | ⏳ Pending | - |

**Overall Progress: 75% Complete** (3 of 4 phases done)

---

## 📋 Daftar Isi

1. [Dashboard](#1-dashboard)
2. [Tickets](#2-tickets)
3. [Knowledge Base](#3-knowledge-base)
4. [Notifications](#4-notifications)
5. [Agents](#5-agents)
6. [Reports](#6-reports)
7. [Renewal](#7-renewal)
8. [Automation](#8-automation)
9. [Settings](#9-settings)
10. [Global Improvements](#10-global-improvements)
11. [Konsistensi Dropdown Menu](#11-konsistensi-dropdown-menu)
12. [Animasi Urgent Ticket/Pesan](#12-animasi-urgent-ticketpesan)
13. [Modernisasi Kalender](#13-modernisasi-kalender)

---

## 1. Dashboard

### 🔍 Kondisi Saat Ini
- Menggunakan layout Bento Grid yang sudah modern
- Memiliki StatCard dengan Sparkline
- Donut dan Bar Chart untuk visualisasi

### ✨ Rekomendasi Improvement

#### A. Visual Enhancements
| Prioritas | Item | Deskripsi |
|-----------|------|-----------|
| 🔴 High | **Hero Section Animation** | Tambahkan gradient animation pada header dengan `background-position` yang bergerak |
| 🟡 Medium | **Card Entry Animation** | Gunakan staggered `animate-fade-in-up` untuk setiap stat card dengan delay bertingkat |
| 🟡 Medium | **Number Counter Animation** | Animasikan angka statistik dengan count-up effect menggunakan `framer-motion` |
| 🟢 Low | **Chart Loading Skeleton** | Skeleton khusus untuk chart dengan shimmer effect yang sesuai bentuk chart |

#### B. Interaksi & Micro-interactions
```css
/* Stat Card Hover Enhancement */
.stat-card {
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.stat-card:hover {
    transform: translateY(-6px) scale(1.02);
    box-shadow: 0 20px 40px -15px rgba(92, 184, 138, 0.3);
    border-color: hsl(150 50% 50% / 0.5);
}
.stat-card:hover .stat-icon {
    transform: rotate(10deg) scale(1.2);
}
```

#### C. Data Visualization Upgrade
- **Sparkline Enhancement**: Tambahkan gradient fill di bawah garis
- **Interactive Tooltips**: Hover pada chart menampilkan detail data dengan animasi pop-in
- **Live Data Pulse**: Indikator kecil berkedip untuk menunjukkan data real-time

#### D. Responsive Improvements
- Mobile: Stack cards vertikal dengan swipe gesture
- Tablet: 2-column grid
- Desktop: Full Bento layout

---

## 2. Tickets

### 🔍 Kondisi Saat Ini
- List view dengan filter dan sorting
- Kanban view tersedia
- Detail page dengan sidebar

### ✨ Rekomendasi Improvement

#### A. List View Enhancements
| Prioritas | Item | Deskripsi |
|-----------|------|-----------|
| 🔴 High | **Priority Color Coding** | Background gradient subtle berdasarkan priority (Critical = red glow, High = orange hint) |
| 🔴 High | **Overdue Animation** | Ticket overdue dengan pulsing red border + shake icon |
| 🟡 Medium | **SLA Progress Bar** | Visual progress bar menunjukkan waktu tersisa sebelum breach |
| 🟡 Medium | **Row Hover Preview** | Quick preview panel muncul di sisi kanan saat hover |
| 🟢 Low | **Bulk Selection Animation** | Checkbox dengan smooth scale animation saat select/deselect |

#### B. Urgent Ticket Animation (CRITICAL)
```css
/* Ticket dengan priority CRITICAL atau status OVERDUE */
@keyframes urgentPulse {
    0%, 100% {
        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
        border-color: rgba(239, 68, 68, 0.4);
    }
    50% {
        box-shadow: 0 0 15px 5px rgba(239, 68, 68, 0.3);
        border-color: rgba(239, 68, 68, 0.8);
    }
}

.ticket-urgent {
    animation: urgentPulse 2s ease-in-out infinite;
    background: linear-gradient(135deg, rgba(254, 226, 226, 0.5) 0%, rgba(254, 202, 202, 0.3) 100%);
}

/* Icon shake untuk urgent */
.ticket-urgent .priority-icon {
    animation: shakeStrong 0.5s ease-in-out infinite;
    animation-delay: 3s; /* Shake setiap 3 detik */
}
```

#### C. Kanban View Improvements
- **Drag Preview Enhancement**: Card yang di-drag memiliki glow dan slight rotation
- **Column Drop Zone**: Highlight area drop yang valid
- **Card Count Badge**: Badge animasi ketika jumlah berubah
- **Swimlane Option**: Tambahkan opsi group by priority di dalam status column

#### D. Detail Page Improvements
- **Shared Element Transition**: Animasi seamless dari list ke detail
- **Timeline Animation**: Activity timeline dengan staggered entry
- **Comment Typing Indicator**: Real-time typing indicator untuk live comments
- **Attachment Preview**: Hover preview untuk attachment files

---

## 3. Knowledge Base

### 🔍 Kondisi Saat Ini
- Article cards dengan kategori
- Search dengan autocomplete
- Category navigation

### ✨ Rekomendasi Improvement

#### A. Search Experience
| Prioritas | Item | Deskripsi |
|-----------|------|-----------|
| 🔴 High | **Command Palette Search** | Ctrl+K untuk quick search dengan fuzzy matching |
| 🔴 High | **Search Highlight** | Highlight keyword matches dalam hasil search |
| 🟡 Medium | **Recent Searches** | Tampilkan pencarian terakhir dengan quick access |
| 🟡 Medium | **AI-Powered Suggestions** | Smart suggestions berbasis context |

#### B. Article Card Design
```css
/* Modern Article Card */
.article-card {
    background: linear-gradient(145deg, #ffffff 0%, #f8fafb 100%);
    border-radius: 16px;
    border: 1px solid rgba(0, 0, 0, 0.06);
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.article-card:hover {
    transform: translateY(-4px);
    box-shadow: 
        0 20px 40px -15px rgba(0, 0, 0, 0.12),
        0 0 0 1px rgba(92, 184, 138, 0.2);
}

.article-card:hover .article-thumbnail {
    transform: scale(1.05);
}
```

#### C. Reading Experience
- **Progress Bar**: Thin progress bar di top saat membaca artikel
- **Table of Contents**: Sticky TOC dengan active section highlight
- **Estimated Read Time**: Badge menunjukkan waktu baca
- **Related Articles**: Carousel di bottom dengan smooth scroll

#### D. Category Navigation
- **Breadcrumb Animation**: Smooth breadcrumb transitions
- **Category Pills**: Scrollable pills dengan active state animation
- **Subcategory Expansion**: Accordion dengan smooth expand/collapse

---

## 4. Notifications

### 🔍 Kondisi Saat Ini
- Grouped by date
- Category tabs (Tickets, Renewal, All)
- Click to navigate

### ✨ Rekomendasi Improvement

#### A. Notification Center Design
| Prioritas | Item | Deskripsi |
|-----------|------|-----------|
| 🔴 High | **Priority Visual Hierarchy** | Urgent notifications dengan distinct styling |
| 🔴 High | **Unread Count Animation** | Badge dengan pulse animation saat ada notifikasi baru |
| 🟡 Medium | **Swipe Actions** | Swipe kiri untuk dismiss, kanan untuk mark read |
| 🟡 Medium | **Sound/Vibration Feedback** | Optional audio cue untuk notifikasi penting |

#### B. Urgent Notification Animation (CRITICAL)
```css
/* Notifikasi urgent (SLA breach, critical ticket) */
@keyframes urgentNotification {
    0%, 100% {
        background: rgba(239, 68, 68, 0.05);
        border-left: 4px solid rgba(239, 68, 68, 0.5);
    }
    50% {
        background: rgba(239, 68, 68, 0.15);
        border-left: 4px solid rgba(239, 68, 68, 1);
    }
}

.notification-urgent {
    animation: urgentNotification 2s ease-in-out infinite;
    position: relative;
}

.notification-urgent::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    width: 8px;
    height: 8px;
    background: #ef4444;
    border-radius: 50%;
    animation: pulseRing 1.5s infinite;
    transform: translateY(-50%);
}
```

#### C. Notification List UX
- **Virtual Scrolling**: Untuk performance dengan banyak notifikasi
- **Grouped Headers**: Sticky date headers saat scroll
- **Empty State**: Ilustrasi dan message yang engaging
- **Bulk Actions**: Select all, mark all as read dengan animasi

#### D. Real-time Updates
- **Toast Notifications**: Pop-up toast untuk notifikasi baru
- **Sound Toggle**: User preference untuk sound alerts
- **Desktop Notifications**: Browser notification integration

---

## 5. Agents

### 🔍 Kondisi Saat Ini
- Agent list dengan statistics
- Role management
- Performance metrics

### ✨ Rekomendasi Improvement

#### A. Agent Cards
| Prioritas | Item | Deskripsi |
|-----------|------|-----------|
| 🔴 High | **Avatar Status Ring** | Ring berwarna menunjukkan status (online/busy/offline) |
| 🟡 Medium | **Performance Sparkline** | Mini chart menunjukkan trend performance |
| 🟡 Medium | **Skill Badges** | Tag pills menunjukkan expertise areas |
| 🟢 Low | **Availability Calendar** | Mini calendar menunjukkan schedule |

#### B. Agent Profile Design
```css
/* Agent Card with Status Ring */
.agent-avatar-container {
    position: relative;
    display: inline-block;
}

.agent-avatar-ring {
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    border: 3px solid transparent;
    animation: ringPulse 2s ease-in-out infinite;
}

.agent-avatar-ring.online {
    border-color: #22c55e;
    box-shadow: 0 0 10px rgba(34, 197, 94, 0.5);
}

.agent-avatar-ring.busy {
    border-color: #f59e0b;
    animation: busyPulse 1.5s ease-in-out infinite;
}

.agent-avatar-ring.offline {
    border-color: #94a3b8;
    animation: none;
}
```

#### C. Workload Visualization
- **Ticket Queue Bars**: Visual bars menunjukkan workload
- **Comparison View**: Side-by-side agent comparison
- **Leaderboard Animation**: Animated leaderboard dengan position changes
- **Heatmap**: Busy hours heatmap per agent

#### D. Management Features
- **Drag & Drop Assignment**: Drag ticket ke agent card
- **Role Hierarchy Diagram**: Visual org chart
- **Permission Matrix**: Interactive matrix untuk role permissions

---

## 6. Reports

### 🔍 Kondisi Saat Ini
- Various report types
- Date range selection
- Export functionality

### ✨ Rekomendasi Improvement

#### A. Chart Enhancements
| Prioritas | Item | Deskripsi |
|-----------|------|-----------|
| 🔴 High | **Chart Entry Animation** | Charts animate dalam dengan path drawing effect |
| 🔴 High | **Interactive Tooltips** | Rich tooltips dengan comparison data |
| 🟡 Medium | **Zoom & Pan** | Interaktif zoom untuk detailed analysis |
| 🟡 Medium | **Annotation System** | Kemampuan menambah notes pada data points |

#### B. Dashboard Layout
```css
/* Report Card with Data Animation */
.report-metric {
    font-variant-numeric: tabular-nums;
    transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.report-metric.positive {
    color: #22c55e;
}

.report-metric.positive::after {
    content: '↑';
    margin-left: 4px;
    animation: bounceSubtle 1s ease-in-out infinite;
}

.report-metric.negative {
    color: #ef4444;
}

.report-metric.negative::after {
    content: '↓';
    margin-left: 4px;
}
```

#### C. Date Range Picker
- **Preset Buttons**: Quick select untuk common ranges
- **Comparison Mode**: Compare with previous period
- **Calendar Heatmap**: Visual intensity pada dates dengan data

#### D. Export & Share
- **Preview Before Export**: Modal preview sebelum download
- **Scheduled Reports**: Setup recurring email reports
- **Share Link**: Generate shareable report link

---

## 7. Renewal

### 🔍 Kondisi Saat Ini
- Contract renewal tracking
- Expiry warnings
- Calendar view

### ✨ Rekomendasi Improvement

#### A. Expiry Timeline
| Prioritas | Item | Deskripsi |
|-----------|------|-----------|
| 🔴 High | **Countdown Animation** | Animated countdown untuk contracts expiring soon |
| 🔴 High | **Urgency Gradient** | Background color intensifies as expiry approaches |
| 🟡 Medium | **Visual Timeline** | Horizontal timeline dengan upcoming renewals |
| 🟡 Medium | **Calendar Integration** | Full calendar view dengan renewal markers |

#### B. Expiring Contract Animation (CRITICAL)
```css
/* Contract expiring dalam 7 hari */
@keyframes expiryWarning {
    0%, 100% {
        background: linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%);
    }
    50% {
        background: linear-gradient(135deg, rgba(251, 191, 36, 0.25) 0%, rgba(245, 158, 11, 0.15) 100%);
    }
}

/* Contract expiring dalam 3 hari - URGENT */
@keyframes expiryUrgent {
    0%, 100% {
        background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.05) 100%);
        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5);
    }
    50% {
        background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.15) 100%);
        box-shadow: 0 0 20px 0 rgba(239, 68, 68, 0.3);
    }
}

.contract-warning {
    animation: expiryWarning 3s ease-in-out infinite;
    border-left: 4px solid #f59e0b;
}

.contract-urgent {
    animation: expiryUrgent 1.5s ease-in-out infinite;
    border-left: 4px solid #ef4444;
}

.contract-expired {
    background: repeating-linear-gradient(
        45deg,
        rgba(239, 68, 68, 0.05),
        rgba(239, 68, 68, 0.05) 10px,
        rgba(239, 68, 68, 0.1) 10px,
        rgba(239, 68, 68, 0.1) 20px
    );
}
```

#### C. Dashboard Widgets
- **Expiry Pie Chart**: Breakdown by time to expiry
- **Revenue at Risk**: Metric card dengan warning styling
- **Action Required List**: Quick actions untuk expiring contracts

---

## 8. Automation

### 🔍 Kondisi Saat Ini
- Rule builder interface
- Trigger configuration
- Action mapping

### ✨ Rekomendasi Improvement

#### A. Visual Rule Builder
| Prioritas | Item | Deskripsi |
|-----------|------|-----------|
| 🔴 High | **Flowchart View** | Visual node-based rule builder |
| 🟡 Medium | **Condition Preview** | Real-time preview hasil rule |
| 🟡 Medium | **Template Library** | Pre-built automation templates |
| 🟢 Low | **Version History** | Track changes dengan visual diff |

#### B. Rule Builder Design
```css
/* Automation Node Connection */
.automation-node {
    background: linear-gradient(145deg, #ffffff 0%, #f1f5f9 100%);
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    padding: 16px;
    transition: all 0.3s ease;
    position: relative;
}

.automation-node:hover {
    border-color: hsl(150, 50%, 50%);
    box-shadow: 0 8px 25px -8px rgba(92, 184, 138, 0.3);
}

.automation-node.trigger {
    border-left: 4px solid #3b82f6;
}

.automation-node.condition {
    border-left: 4px solid #f59e0b;
}

.automation-node.action {
    border-left: 4px solid #22c55e;
}

/* Connection Line Animation */
.automation-connection {
    stroke: hsl(150, 50%, 50%);
    stroke-dasharray: 8 4;
    animation: flowDash 1s linear infinite;
}

@keyframes flowDash {
    to {
        stroke-dashoffset: -12;
    }
}
```

#### C. Testing & Preview
- **Dry Run Mode**: Test automation tanpa execute
- **Sample Data Preview**: Lihat hasil dengan sample data
- **Execution Logs**: Real-time logs dengan syntax highlighting

---

## 9. Settings

### 🔍 Kondisi Saat Ini
- Category-based navigation
- Form-based configuration
- Profile management

### ✨ Rekomendasi Improvement

#### A. Navigation UX
| Prioritas | Item | Deskripsi |
|-----------|------|-----------|
| 🔴 High | **Search Settings** | Quick search untuk find settings |
| 🟡 Medium | **Breadcrumb Navigation** | Clear path indication |
| 🟡 Medium | **Unsaved Changes Alert** | Visual indicator untuk unsaved changes |
| 🟢 Low | **Keyboard Shortcuts** | Power user keyboard navigation |

#### B. Form Interactions
```css
/* Toggle Switch Animation */
.settings-toggle {
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.settings-toggle.enabled {
    background: linear-gradient(135deg, hsl(150, 50%, 50%) 0%, hsl(150, 60%, 40%) 100%);
}

.settings-toggle .toggle-knob {
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.settings-toggle.enabled .toggle-knob {
    transform: translateX(24px);
}

/* Save Button Feedback */
.save-button {
    position: relative;
    overflow: hidden;
}

.save-button.saving::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
    animation: shimmer 1s infinite;
}

.save-button.saved {
    background: #22c55e;
}

.save-button.saved::before {
    content: '✓';
    animation: popIn 0.3s ease-out;
}
```

#### C. Profile Settings
- **Avatar Upload Preview**: Real-time preview dengan crop
- **Theme Preview**: Live theme switching
- **Notification Preferences**: Granular notification controls

---

## 10. Global Improvements

### A. Loading States
```css
/* Unified Skeleton Loading */
.skeleton {
    background: linear-gradient(90deg,
        hsl(40, 15%, 92%) 25%,
        hsl(40, 15%, 88%) 50%,
        hsl(40, 15%, 92%) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 8px;
}

/* Content Loading Overlay */
.content-loading {
    position: relative;
}

.content-loading::after {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(4px);
    display: grid;
    place-items: center;
}
```

### B. Error States
- **Friendly Error Messages**: Helpful error illustrations
- **Retry Actions**: Clear retry buttons dengan animation
- **Offline Indicator**: Banner untuk offline mode

### C. Empty States
```css
/* Empty State Container */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 48px 24px;
    text-align: center;
}

.empty-state-icon {
    width: 120px;
    height: 120px;
    margin-bottom: 24px;
    animation: floatGentle 3s ease-in-out infinite;
}

@keyframes floatGentle {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
}
```

### D. Toast Notifications
- **Stacked Toasts**: Multiple toasts stack nicely
- **Progress Bar**: Auto-dismiss progress indicator
- **Action Buttons**: Quick actions dalam toast

### E. Modal & Dialog
```css
/* Modal Entry Animation */
.modal-backdrop {
    animation: fadeIn 0.2s ease-out;
}

.modal-content {
    animation: modalSlideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes modalSlideIn {
    from {
        opacity: 0;
        transform: scale(0.95) translateY(-10px);
    }
    to {
        opacity: 1;
        transform: scale(1) translateY(0);
    }
}
```

---

## 11. Konsistensi Dropdown Menu

### 🔍 Analisis Current State
Dropdown menu di `dropdown-menu.tsx` sudah menggunakan Radix UI dengan styling konsisten, namun perlu beberapa improvement:

### ✨ Rekomendasi Standarisasi

#### A. Standard Dropdown Styling
```css
/* Konsisten untuk SEMUA dropdown di aplikasi */
.dropdown-menu-content {
    /* Size Tokens */
    min-width: 200px;
    max-width: 320px;
    max-height: 400px;
    
    /* Visual */
    background: white;
    border: 1px solid hsl(40, 10%, 88%);
    border-radius: 12px;
    box-shadow: 
        0 10px 38px -10px rgba(22, 23, 24, 0.35),
        0 10px 20px -15px rgba(22, 23, 24, 0.2);
    
    /* Dark mode */
    .dark & {
        background: hsl(217.2, 32.6%, 12%);
        border-color: hsl(217.2, 32.6%, 20%);
    }
    
    /* Animation */
    animation-duration: 200ms;
    animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
}

.dropdown-menu-item {
    /* Standard padding */
    padding: 10px 12px;
    
    /* Typography */
    font-size: 14px;
    font-weight: 400;
    
    /* Spacing between icon and text */
    gap: 12px;
    
    /* Border radius */
    border-radius: 8px;
    
    /* Hover */
    &:hover, &:focus {
        background: hsl(40, 15%, 94%);
    }
    
    .dark &:hover, .dark &:focus {
        background: hsl(217.2, 32.6%, 17.5%);
    }
}

/* Icon dalam dropdown - KONSISTEN */
.dropdown-menu-item svg {
    width: 16px;
    height: 16px;
    color: hsl(220, 10%, 45%);
    flex-shrink: 0;
}

/* Separator */
.dropdown-menu-separator {
    height: 1px;
    margin: 6px -4px;
    background: hsl(40, 10%, 90%);
}
```

#### B. Variant Dropdowns
| Variant | Use Case | Styling Difference |
|---------|----------|-------------------|
| `default` | General menus | Standard styling |
| `compact` | Toolbar actions | Smaller padding (8px) |
| `with-icons` | Navigation menus | Icon alignment left |
| `with-descriptions` | Complex options | Two-line items |
| `destructive` | Delete/remove actions | Red color on hover |

#### C. Checklist Konsistensi
- [ ] Semua dropdown menggunakan `DropdownMenu` dari `@/components/ui/dropdown-menu`
- [ ] Icon size konsisten: 16px dalam items
- [ ] Padding konsisten: 10px 12px untuk items
- [ ] Border radius: 12px untuk container, 8px untuk items
- [ ] Animation: `zoom-in-95` entry, `zoom-out-95` exit
- [ ] Keyboard navigation: Arrow keys + Enter
- [ ] Focus ring: Visible focus state

---

## 12. Animasi Urgent Ticket/Pesan

### 🔍 Context
Ticket dan pesan yang memerlukan perhatian segera harus memiliki visual yang menonjol untuk menarik perhatian user.

### ✨ Complete Animation System

#### A. Priority-Based Animations
```css
/* ============================================
   URGENT ANIMATION SYSTEM
   ============================================ */

/* CRITICAL Priority - Maximum Urgency */
@keyframes criticalPulse {
    0%, 100% {
        box-shadow: 
            0 0 0 0 rgba(239, 68, 68, 0.7),
            inset 0 0 0 1px rgba(239, 68, 68, 0.3);
        background-color: rgba(254, 226, 226, 0.5);
    }
    50% {
        box-shadow: 
            0 0 20px 4px rgba(239, 68, 68, 0.4),
            inset 0 0 0 2px rgba(239, 68, 68, 0.5);
        background-color: rgba(254, 202, 202, 0.7);
    }
}

.ticket-critical {
    animation: criticalPulse 1.5s ease-in-out infinite;
    border-left: 5px solid #ef4444;
    position: relative;
}

.ticket-critical::before {
    content: '!';
    position: absolute;
    top: 10px;
    right: 10px;
    width: 24px;
    height: 24px;
    background: #ef4444;
    color: white;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-weight: bold;
    font-size: 14px;
    animation: bounceSubtle 1s ease-in-out infinite;
}

/* HIGH Priority - Strong Attention */
@keyframes highPriorityGlow {
    0%, 100% {
        border-color: rgba(249, 115, 22, 0.4);
        box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.5);
    }
    50% {
        border-color: rgba(249, 115, 22, 0.8);
        box-shadow: 0 0 12px 2px rgba(249, 115, 22, 0.3);
    }
}

.ticket-high {
    animation: highPriorityGlow 2s ease-in-out infinite;
    border-left: 4px solid #f97316;
    background: linear-gradient(90deg, rgba(255, 237, 213, 0.5) 0%, transparent 100%);
}

/* OVERDUE Status - Time-based Urgency */
@keyframes overdueShake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
    20%, 40%, 60%, 80% { transform: translateX(2px); }
}

.ticket-overdue {
    animation: 
        criticalPulse 1.5s ease-in-out infinite,
        overdueShake 0.5s ease-in-out 0s 1;
    border-left: 5px solid #dc2626;
}

/* Re-trigger shake every 10 seconds */
.ticket-overdue {
    animation: 
        criticalPulse 1.5s ease-in-out infinite,
        overdueShake 0.5s ease-in-out;
    animation-iteration-count: infinite, 1;
}

/* SLA Breach Warning - Pre-breach Alert */
@keyframes slaBreach {
    0%, 100% {
        background: rgba(251, 191, 36, 0.1);
    }
    50% {
        background: rgba(251, 191, 36, 0.25);
    }
}

.ticket-sla-warning {
    animation: slaBreach 2s ease-in-out infinite;
    border-left: 4px solid #fbbf24;
}

.ticket-sla-warning .sla-countdown {
    color: #d97706;
    font-weight: 600;
    animation: pulseOpacity 1s ease-in-out infinite;
}

@keyframes pulseOpacity {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
}
```

#### B. Implementation Guide
```tsx
// Contoh penggunaan di TicketRow component
const getTicketClassName = (ticket: Ticket) => {
    const classes = ['ticket-row'];
    
    if (ticket.isOverdue) {
        classes.push('ticket-overdue');
    } else if (ticket.priority === 'CRITICAL') {
        classes.push('ticket-critical');
    } else if (ticket.priority === 'HIGH') {
        classes.push('ticket-high');
    }
    
    if (ticket.slaBreachingSoon) {
        classes.push('ticket-sla-warning');
    }
    
    return cn(...classes);
};
```

#### C. Notification Urgency
```css
/* Urgent Notification in Bell Dropdown */
.notification-item.urgent {
    background: linear-gradient(90deg, rgba(239, 68, 68, 0.1) 0%, transparent 50%);
    animation: urgentNotificationPulse 2s ease-in-out infinite;
}

.notification-item.urgent .notification-icon {
    color: #ef4444;
    animation: iconPulse 1.5s ease-in-out infinite;
}

@keyframes iconPulse {
    0%, 100% { 
        transform: scale(1);
        opacity: 1;
    }
    50% { 
        transform: scale(1.2);
        opacity: 0.8;
    }
}
```

---

## 13. Modernisasi Kalender

### 🔍 Analisis Gambar Kalender Saat Ini

Berdasarkan screenshot yang diberikan, kalender saat ini memiliki:
- Header dengan month/year picker
- Navigation arrows
- Basic grid layout
- Pilihan tanggal dengan highlight biru

![Current Calendar](file:///C:/Users/Administrator.FACTORY5/.gemini/antigravity/brain/97f8de0d-ee92-43a3-a423-7cfaeb00ca61/uploaded_image_1765185974655.png)

### ✨ Rekomendasi Modernisasi

#### A. Visual Redesign
```css
/* ============================================
   MODERN CALENDAR DESIGN
   ============================================ */

.calendar-container {
    background: white;
    border-radius: 16px;
    box-shadow: 
        0 10px 38px -10px rgba(22, 23, 24, 0.15),
        0 10px 20px -15px rgba(22, 23, 24, 0.1);
    padding: 20px;
    min-width: 320px;
}

/* Dark mode support */
.dark .calendar-container {
    background: hsl(217.2, 32.6%, 10%);
    border: 1px solid hsl(217.2, 32.6%, 20%);
}

/* Header Styling */
.calendar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px 16px;
    border-bottom: 1px solid hsl(40, 10%, 90%);
    margin-bottom: 16px;
}

.calendar-title {
    font-size: 18px;
    font-weight: 600;
    color: hsl(220, 15%, 15%);
}

.calendar-nav-button {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    background: transparent;
    border: none;
    color: hsl(220, 10%, 45%);
    cursor: pointer;
    transition: all 0.2s ease;
}

.calendar-nav-button:hover {
    background: hsl(40, 15%, 94%);
    color: hsl(150, 50%, 50%);
}

/* Weekday Headers */
.calendar-weekdays {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    text-align: center;
    margin-bottom: 8px;
}

.calendar-weekday {
    font-size: 12px;
    font-weight: 600;
    color: hsl(220, 10%, 45%);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 8px 0;
}

/* Date Grid */
.calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
}

.calendar-day {
    aspect-ratio: 1;
    display: grid;
    place-items: center;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 500;
    color: hsl(220, 15%, 15%);
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    position: relative;
}

/* Hover State */
.calendar-day:hover:not(.disabled):not(.selected) {
    background: hsl(150, 50%, 95%);
    transform: scale(1.1);
}

/* Selected State */
.calendar-day.selected {
    background: linear-gradient(135deg, hsl(150, 50%, 50%) 0%, hsl(150, 60%, 40%) 100%);
    color: white;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(92, 184, 138, 0.4);
    transform: scale(1.05);
}

/* Today Indicator */
.calendar-day.today:not(.selected) {
    border: 2px solid hsl(150, 50%, 50%);
    font-weight: 600;
}

.calendar-day.today.selected {
    box-shadow: 
        0 4px 12px rgba(92, 184, 138, 0.4),
        0 0 0 3px rgba(92, 184, 138, 0.2);
}

/* Outside Month */
.calendar-day.outside-month {
    color: hsl(220, 10%, 70%);
}

/* Disabled */
.calendar-day.disabled {
    color: hsl(220, 10%, 80%);
    cursor: not-allowed;
    opacity: 0.5;
}

/* Event Indicators */
.calendar-day.has-events::after {
    content: '';
    position: absolute;
    bottom: 4px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: hsl(150, 50%, 50%);
}

.calendar-day.has-urgent::after {
    background: #ef4444;
    animation: pulseRing 1.5s infinite;
}

/* Range Selection */
.calendar-day.range-start {
    border-radius: 12px 0 0 12px;
    background: linear-gradient(135deg, hsl(150, 50%, 50%) 0%, hsl(150, 60%, 40%) 100%);
    color: white;
}

.calendar-day.range-end {
    border-radius: 0 12px 12px 0;
    background: linear-gradient(135deg, hsl(150, 50%, 50%) 0%, hsl(150, 60%, 40%) 100%);
    color: white;
}

.calendar-day.in-range {
    background: hsl(150, 50%, 95%);
    border-radius: 0;
}

/* Footer Actions */
.calendar-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 16px;
    margin-top: 16px;
    border-top: 1px solid hsl(40, 10%, 90%);
}

.calendar-action {
    font-size: 14px;
    font-weight: 500;
    color: hsl(150, 50%, 50%);
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px 12px;
    border-radius: 8px;
    transition: all 0.2s ease;
}

.calendar-action:hover {
    background: hsl(150, 50%, 95%);
}

.calendar-action.primary {
    background: linear-gradient(135deg, hsl(150, 50%, 50%) 0%, hsl(150, 60%, 40%) 100%);
    color: white;
}

.calendar-action.primary:hover {
    box-shadow: 0 4px 12px rgba(92, 184, 138, 0.4);
}
```

#### B. Month Transition Animation
```css
/* Month Navigation Animation */
@keyframes slideInFromRight {
    from {
        opacity: 0;
        transform: translateX(50px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

@keyframes slideInFromLeft {
    from {
        opacity: 0;
        transform: translateX(-50px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

.calendar-grid.slide-right {
    animation: slideInFromRight 0.3s ease-out;
}

.calendar-grid.slide-left {
    animation: slideInFromLeft 0.3s ease-out;
}

/* Day Number Entry Animation */
.calendar-day {
    animation: fadeIn 0.2s ease-out;
    animation-fill-mode: forwards;
}

.calendar-day:nth-child(1) { animation-delay: 0.01s; }
.calendar-day:nth-child(2) { animation-delay: 0.02s; }
.calendar-day:nth-child(3) { animation-delay: 0.03s; }
/* ... continue for all days */
```

#### C. Quick Selection Presets
```css
/* Preset Chips */
.calendar-presets {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    padding-bottom: 16px;
    margin-bottom: 16px;
    border-bottom: 1px solid hsl(40, 10%, 90%);
}

.calendar-preset {
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 500;
    border-radius: 20px;
    background: hsl(40, 15%, 94%);
    color: hsl(220, 15%, 25%);
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
}

.calendar-preset:hover {
    background: hsl(150, 50%, 95%);
    color: hsl(150, 50%, 40%);
}

.calendar-preset.active {
    background: linear-gradient(135deg, hsl(150, 50%, 50%) 0%, hsl(150, 60%, 40%) 100%);
    color: white;
}
```

#### D. Implementation with Framer Motion
```tsx
// ModernCalendar.tsx
import { motion, AnimatePresence } from 'framer-motion';

const dayVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: (i: number) => ({
        opacity: 1,
        scale: 1,
        transition: {
            delay: i * 0.02,
            duration: 0.2,
            ease: [0.34, 1.56, 0.64, 1]
        }
    })
};

const MonthCalendar = ({ month, direction }) => (
    <AnimatePresence mode="wait">
        <motion.div
            key={month}
            initial={{ opacity: 0, x: direction > 0 ? 50 : -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction > 0 ? -50 : 50 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="calendar-grid"
        >
            {days.map((day, index) => (
                <motion.button
                    key={day.date}
                    custom={index}
                    variants={dayVariants}
                    initial="hidden"
                    animate="visible"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className={cn('calendar-day', {
                        'selected': isSelected(day),
                        'today': isToday(day),
                        'outside-month': !isSameMonth(day, month),
                        'has-events': hasEvents(day),
                        'has-urgent': hasUrgentEvents(day)
                    })}
                    onClick={() => onSelectDate(day)}
                >
                    {day.getDate()}
                </motion.button>
            ))}
        </motion.div>
    </AnimatePresence>
);
```

---

## 📊 Ringkasan Prioritas

| Priority | Area | Key Improvements | Status |
|----------|------|------------------|--------|
| 🔴 **High** | Urgent Animations | Pulsing, shaking, glowing untuk critical items | ✅ Done |
| 🔴 **High** | Calendar Modern | Redesign sesuai tema, smooth animations | ✅ Done |
| 🔴 **High** | Dropdown Consistency | Standardisasi styling dan behavior | ✅ Done |
| 🔴 **High** | Dashboard Enhancements | Stat cards, charts, leaderboard animations | ✅ Done |
| 🔴 **High** | Knowledge Base | Article cards, category pills, hero gradient | ✅ Done |
| 🟡 **Medium** | Page Transitions | Staggered list, shared element | ✅ Done |
| 🟡 **Medium** | Chart Animations | Entry animations, bar grow, SLA ring | ✅ Done |
| 🟡 **Medium** | Loading States | Skeleton matching content shape | ✅ Done |
| 🟡 **Medium** | Reports Enhancement | Report metrics with trend indicators | ✅ Done |
| 🟡 **Medium** | Settings UX | Tab animations, hover effects | ✅ Done |
| 🟢 **Low** | Micro-interactions | Button feedback, icon animations | ✅ Done |
| 🟢 **Low** | Empty States | Engaging illustrations | ✅ Done |

---

## ⏱️ Estimated Implementation Timeline

| Phase | Duration | Tasks | Status |
|-------|----------|-------|--------|
| **Phase 1** | 3-4 days | Urgent animations, Calendar modernization | ✅ **COMPLETED** |
| **Phase 2** | 3-4 days | Dropdown consistency, Global animations | ✅ **COMPLETED** |
| **Phase 3** | 5-7 days | Per-page improvements (Dashboard, KB, Reports, Settings) | ✅ **COMPLETED** |
| **Phase 4** | 2-3 days | Testing & Polish | ⏳ Pending |

---

## 📋 Implementation Log

### Phase 1 - Completed (2025-12-08)

#### ✅ Urgent Animation System
Added to `apps/frontend/src/index.css`:
- `animate-critical-pulse` - Red pulsing glow for CRITICAL priority tickets
- `animate-high-priority` - Orange glow animation for HIGH priority  
- `animate-overdue` - Critical pulse + shake animation for overdue items
- `animate-sla-warning` - Yellow warning pulse for approaching SLA breach
- `animate-notification-urgent` - Pulsing animation for urgent notifications
- `animate-contract-warning` - Warning animation for expiring contracts (7 days)
- `animate-contract-urgent` - Urgent animation for contracts expiring soon (3 days)
- `animate-contract-expired` - Striped background for expired contracts
- `animate-icon-pulse` / `animate-attention-badge` - Utility animations

#### ✅ Applied Animations to Components
- **BentoTicketListPage.tsx** - Ticket rows animate based on priority/overdue status
- **BentoTicketKanban.tsx** - Kanban cards animate based on SLA/priority
- **NotificationCenter.tsx** - Urgent notifications (SLA breach, renewals) now pulse
- **ContractTable.tsx** - Contract rows animate based on expiry status

#### ✅ Modern Calendar Component
Created new components:
- **ModernCalendar.tsx** (`apps/frontend/src/components/ui/ModernCalendar.tsx`)
  - Full-featured calendar with modern styling
  - Month transitions with slide animations
  - Day entry stagger animations
  - Range selection support
  - Event indicators
  - Today highlight
  - Presets support
  
- **ModernDatePicker.tsx** (`apps/frontend/src/components/ui/ModernDatePicker.tsx`)
  - Popover-based date picker
  - Uses ModernCalendar internally
  - Clean integration with forms

#### ✅ Modern Calendar CSS Styles
Added to `index.css`:
- `.calendar-modern` - Base container
- `.calendar-header` / `.calendar-title` / `.calendar-nav-btn`
- `.calendar-weekdays` / `.calendar-weekday`
- `.calendar-grid` / `.calendar-day`
- Selected, today, outside-month, disabled states
- Range selection styles (`.range-start`, `.range-end`, `.in-range`)
- Event indicators (`.has-events`, `.has-urgent`)
- Month transition animations (`.calendar-slide-right`, `.calendar-slide-left`)
- Day entry animation (`.calendar-day-animate`)

### Phase 2 - Completed (2025-12-08)

#### ✅ Dropdown Menu Enhancements
Updated `apps/frontend/src/components/ui/dropdown-menu.tsx`:
- Added `variant` prop for content: `default`, `compact`, `wide`
- Enhanced shadow and border styling with backdrop blur
- Better animation timing (200ms with ease-out)
- Added `variant` prop for items: `default`, `destructive`
- Improved icon styling with hover color change
- Better padding and gap consistency (px-3 py-2.5, gap-3)

#### ✅ Dialog/Modal Improvements
Updated `apps/frontend/src/components/ui/dialog.tsx`:
- Added `size` prop: `sm`, `default`, `lg`, `xl`, `full`
- Enhanced backdrop with blur effect (bg-black/60 backdrop-blur-sm)
- Improved close button styling with hover state
- Better shadow and border radius (rounded-2xl)
- Smoother animations (300ms duration)

#### ✅ EmptyState Component Enhancement
Updated `apps/frontend/src/components/ui/EmptyState.tsx`:
- Added `title` prop for optional heading
- Added `size` prop: `sm`, `default`, `lg`
- Added `action` prop with label and onClick
- Floating animation on icon
- Fade-in-up animation on container
- Gradient background on icon container

#### ✅ Global CSS Improvements
Added to `apps/frontend/src/index.css`:

**Loading States:**
- `.skeleton-enhanced` - Improved shimmer animation
- `.skeleton-text`, `.skeleton-title`, `.skeleton-avatar`, etc.
- `.content-loading-overlay` - Blur overlay for loading content
- `.loading-spinner`, `.loading-spinner-lg` - Spinner variants
- `.loading-dots` - Bouncing dots animation

**Error States:**
- `.error-state` - Error container styling
- `.error-state-icon` - Shake animation on error icon
- `.error-state-action` - Retry button with hover effects

**Toast Improvements:**
- `.toast-enhanced` - Modern toast styling
- `.toast-progress` - Auto-dismiss progress bar

**Page Transitions:**
- `.page-transition` - Fade-in animation for pages
- `.stagger-list` - Staggered animation for list items (10 levels)

**Glass Card Variants:**
- `.glass-card` - Standard glass morphism
- `.glass-card-elevated` - Elevated glass card with stronger blur
- `.glass-shadow-medium` - Medium shadow variant

**Other Utilities:**
- `.dropdown-item-enhanced` - Left border indicator on hover
- `.animate-success-pop` - Success animation
- `.checkmark-animated` - Draw-in checkmark animation
- `.focus-ring-enhanced` - Enhanced focus ring styling
- `.offline-banner` - Slide-down offline indicator

---

### Phase 3: Per-Page Improvements ✅
**Completed:** December 8, 2025

#### ✅ Dashboard Enhancements
Updated `apps/frontend/src/features/dashboard/pages/BentoDashboardPage.tsx`:
- Added `.stat-card-enhanced` class to StatCard component for enhanced hover effects
- Added `.stat-icon` class for icon rotation animation on hover
- Added `.count-up` animation for number display
- Added `.chart-bar-animated` to MiniBarChart with staggered delays
- Added `.sla-ring-animated` to SLA compliance circle
- Added `.live-indicator` pulse animation to Weekly Activity section
- Enhanced Top Agents with `.leaderboard-item` and `.avatar-status-ring` classes
- Added trophy emojis for top 3 agents

#### ✅ Knowledge Base Improvements
Updated `apps/frontend/src/features/knowledge-base/pages/BentoKnowledgeBasePage.tsx`:
- Applied `.hero-gradient` animated gradient to hero section
- Added `.category-pills` and `.category-pill` for filter tabs

Updated `apps/frontend/src/components/ui/ArticleCard.tsx`:
- Applied `.article-card-enhanced` for hover lift animation
- Added `.article-thumbnail` for image scale on hover

#### ✅ Reports Page Enhancement
Updated `apps/frontend/src/features/reports/pages/BentoReportsPage.tsx`:
- Added `trend` prop to ReportCard component
- Applied `.stat-card-enhanced`, `.stat-icon` classes
- Added `.count-up` and `.report-metric` classes with positive/negative indicators

#### ✅ Settings Page Enhancement
Updated `apps/frontend/src/features/settings/pages/BentoSettingsPage.tsx`:
- Added `.hover-lift` to tab triggers
- Added staggered animation delays for tab items

#### ✅ Phase 3 CSS Additions
Added 550+ lines to `apps/frontend/src/index.css`:

**Dashboard:**
- `.hero-gradient` - Animated gradient background
- `.stat-card-enhanced` - Enhanced hover with scale and shadow
- `.count-up` - Number animation
- `.chart-bar-animated` - Staggered bar grow animation
- `.sla-ring-animated` - SLA ring fill animation
- `.live-indicator` - Pulsing live data indicator

**Knowledge Base:**
- `.article-card-enhanced` - Card hover with lift and shadow
- `.article-thumbnail` - Image scale on hover
- `.search-highlight` - Yellow highlight for search matches
- `.reading-progress` - Fixed reading progress bar

**Agents:**
- `.avatar-status-ring` - Online/busy/offline ring with pulse
- `.leaderboard-item` - Moving up/down animations

**Reports:**
- `.report-metric` - Tabular nums with positive/negative indicators
- `.sla-progress-bar` - Safe/warning/danger states

**Tickets:**
- `.priority-bar` - Gradient color bars with glow
- `.row-hover-preview` - Quick preview panel on hover

**UI Elements:**
- `.category-pills` - Horizontal scrolling pills container
- `.category-pill` - Filter pill with active state
- `.breadcrumb-animated` - Staggered breadcrumb fade-in

**Settings:**
- `.settings-search-highlight` - Highlight animation for search
- `.form-input-animated` - Floating label animation
- `.toggle-enhanced` - Enhanced toggle with spring animation
- `.save-button-animated` - Saving shimmer and saved feedback

---

## 🛠️ Tech Stack Recommendations

- **Animation Library**: Framer Motion (sudah terintegrasi)
- **Icons**: Lucide React (konsisten dengan yang ada)
- **Calendar**: react-day-picker atau custom dengan framer-motion
- **Charts**: Recharts dengan custom animations
- **Transitions**: View Transitions API atau React Router DOM's useViewTransitionState

---

> 📝 **Note**: Dokumen ini adalah living document yang akan diupdate sesuai dengan feedback dan progress implementasi.
