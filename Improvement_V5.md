# Improvement_V5.md
## iDesk Enterprise Platform - Comprehensive Enhancement Roadmap
**Tanggal:** 30 November 2025  
**Versi:** 5.0  
**Status:** Planning Phase

---

## 📋 Table of Contents
1. [Design System Improvements](#1-design-system-improvements)
2. [UI/UX Enhancements](#2-uiux-enhancements)
3. [Animation & Micro-interactions](#3-animation--micro-interactions)
4. [Logo & Branding](#4-logo--branding)
5. [Functional Improvements](#5-functional-improvements)
6. [Performance Optimizations](#6-performance-optimizations)
7. [Mobile Experience](#7-mobile-experience)
8. [Accessibility](#8-accessibility)
9. [Implementation Priority](#9-implementation-priority)

---

## 1. Design System Improvements

### 1.1 Color Palette Refinement
**Current State:** Menggunakan mint green sebagai primary dengan warm cream background.

**Improvements:**

#### A. Extended Color Tokens
```css
/* Tambahkan semantic color tokens */
:root {
  /* Success States */
  --success-50: 142 76% 95%;
  --success-500: 142 76% 36%;
  --success-600: 142 72% 29%;
  
  /* Warning States */
  --warning-50: 45 93% 95%;
  --warning-500: 45 93% 47%;
  --warning-600: 32 95% 44%;
  
  /* Error States */
  --error-50: 0 86% 97%;
  --error-500: 0 84% 60%;
  --error-600: 0 72% 51%;
  
  /* Info States */
  --info-50: 214 95% 95%;
  --info-500: 214 100% 50%;
  --info-600: 214 93% 40%;
  
  /* Neutral Gray Scale - More refined */
  --gray-25: 0 0% 99%;
  --gray-50: 0 0% 98%;
  --gray-100: 0 0% 96%;
  --gray-200: 0 0% 92%;
  --gray-300: 0 0% 86%;
  --gray-400: 0 0% 65%;
  --gray-500: 0 0% 45%;
  --gray-600: 0 0% 32%;
  --gray-700: 0 0% 24%;
  --gray-800: 0 0% 14%;
  --gray-900: 0 0% 9%;
}
```

#### B. Gradient System
**File:** `apps/frontend/src/index.css`
```css
/* Premium Gradient Collection */
.gradient-primary {
  background: linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(150 60% 40%) 100%);
}

.gradient-success {
  background: linear-gradient(135deg, #10B981 0%, #059669 100%);
}

.gradient-warning {
  background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
}

.gradient-danger {
  background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);
}

.gradient-info {
  background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
}

.gradient-purple {
  background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%);
}

.gradient-hero {
  background: linear-gradient(135deg, 
    hsl(var(--primary)) 0%, 
    hsl(180 60% 45%) 50%, 
    hsl(200 70% 50%) 100%
  );
}

/* Glass Morphism Variants */
.glass-light {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.glass-dark {
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

### 1.2 Typography System
**Current Issue:** Inconsistent font weights and sizes across components.

**Solution:**
```css
/* Typography Scale */
:root {
  /* Display */
  --text-display-2xl: 4.5rem;    /* 72px */
  --text-display-xl: 3.75rem;    /* 60px */
  --text-display-lg: 3rem;       /* 48px */
  --text-display-md: 2.25rem;    /* 36px */
  --text-display-sm: 1.875rem;   /* 30px */
  
  /* Headings */
  --text-h1: 1.5rem;    /* 24px */
  --text-h2: 1.25rem;   /* 20px */
  --text-h3: 1.125rem;  /* 18px */
  --text-h4: 1rem;      /* 16px */
  
  /* Body */
  --text-body-lg: 1.125rem;  /* 18px */
  --text-body-md: 1rem;      /* 16px */
  --text-body-sm: 0.875rem;  /* 14px */
  --text-body-xs: 0.75rem;   /* 12px */
  
  /* Line Heights */
  --leading-tight: 1.25;
  --leading-snug: 1.375;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;
  --leading-loose: 2;
}
```

### 1.3 Spacing & Layout System
```css
/* Consistent Spacing Scale */
:root {
  --space-0: 0;
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.25rem;   /* 20px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */
  --space-20: 5rem;     /* 80px */
  --space-24: 6rem;     /* 96px */
}
```

---

## 2. UI/UX Enhancements

### 2.1 Dashboard Improvements

#### A. Enhanced Stats Cards with Sparklines
**File:** `apps/frontend/src/features/dashboard/pages/BentoDashboardPage.tsx`

```tsx
// Tambahkan mini sparkline chart di setiap stat card
const StatCardWithSparkline: React.FC<{
  title: string;
  value: number;
  icon: LucideIcon;
  color: string;
  trend: number[];
  trendDirection: 'up' | 'down' | 'neutral';
}> = ({ title, value, icon: Icon, color, trend, trendDirection }) => (
  <div className="group bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
    <div className="flex items-start justify-between mb-4">
      <div className={`p-3 rounded-xl ${color} shadow-lg group-hover:scale-110 transition-transform`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <Sparkline data={trend} direction={trendDirection} />
    </div>
    <p className="text-3xl font-bold text-slate-800 dark:text-white">{value}</p>
    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{title}</p>
  </div>
);

// Sparkline Component
const Sparkline: React.FC<{ data: number[]; direction: string }> = ({ data, direction }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * 60;
    const y = 20 - ((val - min) / range) * 20;
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <svg width="64" height="24" className="overflow-visible">
      <polyline
        fill="none"
        stroke={direction === 'up' ? '#10B981' : direction === 'down' ? '#EF4444' : '#6B7280'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};
```

#### B. Real-time Activity Feed
```tsx
// Tambahkan live activity feed di dashboard
const ActivityFeed: React.FC = () => {
  const activities = useRealtimeActivities();
  
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <h3 className="font-bold text-slate-800 dark:text-white">Live Activity</h3>
      </div>
      <div className="max-h-80 overflow-y-auto">
        <AnimatePresence>
          {activities.map((activity) => (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="px-6 py-3 border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <ActivityItem activity={activity} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
```

### 2.2 Ticket List Improvements

#### A. Table Header Sticky dengan Summary
```tsx
// Sticky header dengan running totals
const StickyTableHeader: React.FC = () => (
  <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700">
    <div className="flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-500">
          Showing <strong>{filteredTickets.length}</strong> of {tickets.length} tickets
        </span>
        {selectedTickets.length > 0 && (
          <span className="text-sm text-primary font-medium">
            {selectedTickets.length} selected
          </span>
        )}
      </div>
      <BulkActionsMenu selectedCount={selectedTickets.length} />
    </div>
  </div>
);
```

#### B. Quick Preview Panel
```tsx
// Hover preview untuk ticket tanpa navigasi
const TicketQuickPreview: React.FC<{ ticket: Ticket }> = ({ ticket }) => (
  <HoverCard.Root openDelay={300}>
    <HoverCard.Trigger asChild>
      <div className="cursor-pointer">...</div>
    </HoverCard.Trigger>
    <HoverCard.Portal>
      <HoverCard.Content 
        className="w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 animate-scale-in"
        side="right"
        sideOffset={10}
      >
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-mono text-xs text-slate-400">#{ticket.ticketNumber}</span>
              <h4 className="font-bold text-slate-800 dark:text-white mt-1">{ticket.title}</h4>
            </div>
            <StatusBadge status={ticket.status} />
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3">
            {ticket.description}
          </p>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <UserAvatar user={ticket.user} size="xs" />
              <span className="text-slate-500">{ticket.user.fullName}</span>
            </div>
            <span className="text-slate-400">{formatTimeAgo(ticket.createdAt)}</span>
          </div>
        </div>
        <HoverCard.Arrow className="fill-white dark:fill-slate-800" />
      </HoverCard.Content>
    </HoverCard.Portal>
  </HoverCard.Root>
);
```

### 2.3 Ticket Detail Improvements

#### A. Collapsible Sections
```tsx
// Collapsible sidebar sections dengan memory
const CollapsibleSection: React.FC<{
  title: string;
  icon: LucideIcon;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, icon: Icon, defaultOpen = true, children }) => {
  const [isOpen, setIsOpen] = useLocalStorage(`section-${title}`, defaultOpen);
  
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
      >
        <span className="flex items-center gap-2 font-medium text-slate-800 dark:text-white">
          <Icon className="w-4 h-4" />
          {title}
        </span>
        <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
```

#### B. Enhanced Chat Experience
```tsx
// Chat dengan typing indicator, reactions, dan threading
const EnhancedChatMessage: React.FC<{ message: Message }> = ({ message }) => (
  <div className={cn(
    "group relative flex gap-3 p-4 rounded-2xl transition-all",
    message.isFromAgent 
      ? "bg-primary/5 ml-12" 
      : "bg-slate-50 dark:bg-slate-800/50 mr-12"
  )}>
    <UserAvatar user={message.sender} size="sm" />
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-medium text-slate-800 dark:text-white">
          {message.sender.fullName}
        </span>
        <span className="text-xs text-slate-400">
          {formatTimeAgo(message.createdAt)}
        </span>
        {message.isEdited && (
          <span className="text-xs text-slate-400 italic">(edited)</span>
        )}
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none">
        {message.content}
      </div>
      {message.attachments?.length > 0 && (
        <MessageAttachments attachments={message.attachments} />
      )}
      
      {/* Reactions */}
      <MessageReactions 
        reactions={message.reactions} 
        messageId={message.id} 
      />
    </div>
    
    {/* Quick Actions on Hover */}
    <div className="absolute -top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <div className="flex items-center gap-1 bg-white dark:bg-slate-700 rounded-lg shadow-lg border border-slate-200 dark:border-slate-600 p-1">
        <button className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-600 rounded">
          <SmilePlus className="w-4 h-4 text-slate-400" />
        </button>
        <button className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-600 rounded">
          <Reply className="w-4 h-4 text-slate-400" />
        </button>
        <button className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-600 rounded">
          <MoreHorizontal className="w-4 h-4 text-slate-400" />
        </button>
      </div>
    </div>
  </div>
);
```

### 2.4 Knowledge Base Improvements

#### A. Article Card dengan Reading Time
```tsx
const ArticleCard: React.FC<{ article: Article }> = ({ article }) => {
  const readingTime = useMemo(() => {
    const words = article.content.split(/\s+/).length;
    return Math.ceil(words / 200);
  }, [article.content]);
  
  return (
    <Link 
      to={`/kb/${article.id}`}
      className="group block bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
    >
      {/* Featured Image */}
      <div className="relative h-48 bg-gradient-to-br from-primary/20 to-blue-500/20 overflow-hidden">
        {article.featuredImage ? (
          <img 
            src={article.featuredImage} 
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <BookOpen className="w-16 h-16 text-primary/30" />
          </div>
        )}
        <div className="absolute top-4 left-4">
          <span className="px-3 py-1 bg-white/90 dark:bg-slate-800/90 backdrop-blur rounded-full text-xs font-bold text-primary">
            {article.category}
          </span>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-6">
        <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-2 group-hover:text-primary transition-colors line-clamp-2">
          {article.title}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">
          {stripHtml(article.content)}
        </p>
        
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {readingTime} min read
            </span>
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              {article.viewCount} views
            </span>
          </div>
          <span>{formatDate(article.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
};
```

#### B. Article Search dengan Autocomplete
```tsx
const ArticleSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  
  const { data: suggestions } = useQuery({
    queryKey: ['kb-suggestions', debouncedQuery],
    queryFn: () => api.get(`/kb/search/suggestions?q=${debouncedQuery}`),
    enabled: debouncedQuery.length >= 2,
  });
  
  return (
    <Command className="rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl">
      <CommandInput 
        placeholder="Search articles..." 
        value={query}
        onValueChange={setQuery}
        className="h-14 text-lg"
      />
      <CommandList>
        <CommandEmpty>No articles found.</CommandEmpty>
        <CommandGroup heading="Suggestions">
          {suggestions?.map((article) => (
            <CommandItem key={article.id}>
              <BookOpen className="w-4 h-4 mr-2" />
              <span>{article.title}</span>
              <span className="ml-auto text-xs text-slate-400">{article.category}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Categories">
          {CATEGORIES.map((cat) => (
            <CommandItem key={cat}>
              <Folder className="w-4 h-4 mr-2" />
              {cat}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
};
```

---

## 3. Animation & Micro-interactions

### 3.1 Page Transitions
**File:** `apps/frontend/src/App.tsx`

```tsx
import { AnimatePresence, motion } from 'framer-motion';

const pageVariants = {
  initial: { 
    opacity: 0, 
    y: 20,
    filter: 'blur(10px)'
  },
  animate: { 
    opacity: 1, 
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1]
    }
  },
  exit: { 
    opacity: 0, 
    y: -20,
    filter: 'blur(10px)',
    transition: {
      duration: 0.3
    }
  }
};

// Wrap routes with AnimatePresence
<AnimatePresence mode="wait">
  <motion.div
    key={location.pathname}
    variants={pageVariants}
    initial="initial"
    animate="animate"
    exit="exit"
  >
    <Outlet />
  </motion.div>
</AnimatePresence>
```

### 3.2 List Stagger Animation
```tsx
const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.05
    }
  }
};

const listItem = {
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1]
    }
  }
};

// Usage
<motion.div variants={staggerContainer} initial="initial" animate="animate">
  {items.map((item) => (
    <motion.div key={item.id} variants={listItem}>
      <ItemComponent item={item} />
    </motion.div>
  ))}
</motion.div>
```

### 3.3 Button Micro-interactions
**File:** `apps/frontend/src/components/ui/button.tsx`

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-primary text-white hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25 focus-visible:ring-primary",
        destructive: "bg-red-500 text-white hover:bg-red-600 hover:shadow-lg hover:shadow-red-500/25",
        outline: "border-2 border-slate-200 dark:border-slate-700 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800",
        ghost: "bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800",
        link: "text-primary underline-offset-4 hover:underline",
        success: "bg-green-500 text-white hover:bg-green-600 hover:shadow-lg hover:shadow-green-500/25",
        warning: "bg-yellow-500 text-white hover:bg-yellow-600 hover:shadow-lg hover:shadow-yellow-500/25",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-6 text-sm",
        lg: "h-12 px-8 text-base",
        xl: "h-14 px-10 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);
```

### 3.4 Loading States
```tsx
// Skeleton with shimmer effect
const SkeletonCard: React.FC = () => (
  <div className="relative overflow-hidden bg-slate-100 dark:bg-slate-800 rounded-2xl p-6">
    <div className="space-y-4">
      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
      <div className="h-20 bg-slate-200 dark:bg-slate-700 rounded" />
    </div>
    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_1.5s_infinite]" />
  </div>
);

// Pulse loading dots
const LoadingDots: React.FC = () => (
  <div className="flex items-center gap-1">
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        className="w-2 h-2 bg-primary rounded-full animate-bounce"
        style={{ animationDelay: `${i * 0.15}s` }}
      />
    ))}
  </div>
);
```

### 3.5 Notification Animations
```tsx
// Toast notification dengan slide + fade
const toastAnimation = {
  initial: { opacity: 0, y: -20, scale: 0.95 },
  animate: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 25
    }
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    transition: { duration: 0.2 }
  }
};

// Badge pulse untuk unread notifications
const NotificationBadge: React.FC<{ count: number }> = ({ count }) => (
  <span className="relative flex h-5 w-5">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
    <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 text-white text-xs font-bold items-center justify-center">
      {count > 9 ? '9+' : count}
    </span>
  </span>
);
```

### 3.6 Hover Effects
```css
/* Card hover lift */
.card-hover {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), 
              box-shadow 0.3s ease;
}

.card-hover:hover {
  transform: translateY(-4px);
  box-shadow: 
    0 10px 40px -10px rgba(0, 0, 0, 0.15),
    0 4px 6px -4px rgba(0, 0, 0, 0.1);
}

/* Icon rotate on hover */
.icon-rotate-hover {
  transition: transform 0.3s ease;
}

.group:hover .icon-rotate-hover {
  transform: rotate(15deg);
}

/* Scale on click */
.scale-click {
  transition: transform 0.15s ease;
}

.scale-click:active {
  transform: scale(0.95);
}

/* Underline animation */
.underline-animate {
  position: relative;
}

.underline-animate::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 0;
  height: 2px;
  background: currentColor;
  transition: width 0.3s ease;
}

.underline-animate:hover::after {
  width: 100%;
}
```

---

## 4. Logo & Branding

### 4.1 Logo Improvements

#### A. Create SVG Logo Component
**File:** `apps/frontend/src/components/ui/Logo.tsx`

```tsx
import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon' | 'text';
  className?: string;
}

const sizeClasses = {
  sm: { icon: 'w-8 h-8', text: 'text-lg' },
  md: { icon: 'w-10 h-10', text: 'text-xl' },
  lg: { icon: 'w-12 h-12', text: 'text-2xl' },
  xl: { icon: 'w-16 h-16', text: 'text-3xl' },
};

export const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  variant = 'full',
  className 
}) => {
  const IconLogo = () => (
    <div className={cn(
      "relative rounded-2xl bg-gradient-to-br from-primary via-primary to-emerald-600 flex items-center justify-center shadow-lg shadow-primary/25",
      sizeClasses[size].icon,
      className
    )}>
      {/* Modern iD monogram */}
      <svg viewBox="0 0 40 40" fill="none" className="w-[60%] h-[60%]">
        {/* i letter */}
        <circle cx="12" cy="10" r="3" fill="white" />
        <rect x="10" y="16" width="4" height="16" rx="2" fill="white" />
        
        {/* D letter with connection */}
        <path 
          d="M20 8h6c6 0 10 4 10 12s-4 12-10 12h-6V8z" 
          stroke="white" 
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        
        {/* Connecting line */}
        <rect x="14" y="20" width="6" height="4" rx="2" fill="white" opacity="0.8" />
      </svg>
      
      {/* Subtle shine effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/20 to-transparent" />
    </div>
  );

  if (variant === 'icon') return <IconLogo />;
  
  if (variant === 'text') {
    return (
      <span className={cn(
        "font-bold tracking-tight",
        sizeClasses[size].text,
        className
      )}>
        <span className="text-slate-800 dark:text-white">i</span>
        <span className="text-primary">Desk</span>
      </span>
    );
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <IconLogo />
      <span className={cn(
        "font-bold tracking-tight",
        sizeClasses[size].text
      )}>
        <span className="text-slate-800 dark:text-white">i</span>
        <span className="text-primary">Desk</span>
      </span>
    </div>
  );
};
```

### 4.2 Favicon Update
**File:** `apps/frontend/public/favicon.svg`

```svg
<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#5CB88A"/>
      <stop offset="100%" style="stop-color:#059669"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="8" fill="url(#grad)"/>
  <circle cx="10" cy="8" r="2.5" fill="white"/>
  <rect x="8" y="13" width="4" height="12" rx="2" fill="white"/>
  <path d="M16 6h5c5 0 8 3.5 8 10s-3 10-8 10h-5V6z" stroke="white" stroke-width="3.5" fill="none" stroke-linecap="round"/>
</svg>
```

### 4.3 Loading Screen dengan Logo
```tsx
const AppLoadingScreen: React.FC = () => (
  <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
    <div className="text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <Logo size="xl" variant="icon" className="mx-auto mb-6" />
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Logo size="lg" variant="text" />
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-8"
      >
        <div className="flex items-center justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 bg-primary rounded-full"
              animate={{ y: [-4, 4, -4] }}
              transition={{
                repeat: Infinity,
                duration: 0.6,
                delay: i * 0.1,
              }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  </div>
);
```

---

## 5. Functional Improvements

### 5.1 Advanced Search & Filter

#### A. Global Search Command Palette
**File:** `apps/frontend/src/components/GlobalSearchCommand.tsx`

```tsx
import { Command } from 'cmdk';

export const GlobalSearchCommand: React.FC = () => {
  const [open, setOpen] = useState(false);
  
  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <Command.Dialog 
      open={open} 
      onOpenChange={setOpen}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
    >
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
      
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <Command.Input 
          placeholder="Search tickets, articles, agents..."
          className="w-full h-14 px-6 text-lg bg-transparent border-b border-slate-200 dark:border-slate-700 outline-none"
        />
        
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-slate-500">
            No results found.
          </Command.Empty>
          
          <Command.Group heading="Tickets" className="p-2">
            {/* Ticket results */}
          </Command.Group>
          
          <Command.Group heading="Knowledge Base" className="p-2">
            {/* KB results */}
          </Command.Group>
          
          <Command.Group heading="Quick Actions" className="p-2">
            <Command.Item onSelect={() => navigate('/tickets/create')}>
              <Plus className="w-4 h-4 mr-2" />
              Create new ticket
            </Command.Item>
            <Command.Item onSelect={() => navigate('/kb/create')}>
              <FileText className="w-4 h-4 mr-2" />
              Write new article
            </Command.Item>
          </Command.Group>
        </Command.List>
        
        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
          <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">⌘K</span>
        </div>
      </div>
    </Command.Dialog>
  );
};
```

### 5.2 Saved Filters & Views

```tsx
// Save custom filter configurations
interface SavedFilter {
  id: string;
  name: string;
  filters: {
    status?: string[];
    priority?: string[];
    assignee?: string[];
    dateRange?: { start: Date; end: Date };
    tags?: string[];
  };
  isDefault?: boolean;
}

const SavedFiltersDropdown: React.FC = () => {
  const { savedFilters, createFilter, deleteFilter, applyFilter } = useSavedFilters();
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Bookmark className="w-4 h-4" />
          Saved Views
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {savedFilters.map((filter) => (
          <DropdownMenuItem
            key={filter.id}
            onClick={() => applyFilter(filter)}
            className="flex items-center justify-between"
          >
            <span>{filter.name}</span>
            {filter.isDefault && (
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setShowSaveDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Save current view
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
```

### 5.3 Ticket Quick Actions

```tsx
// Keyboard shortcuts for common actions
const useTicketShortcuts = (ticket: Ticket) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only if not in input/textarea
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return;
      
      switch (e.key) {
        case 'a':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            openAssignModal();
          }
          break;
        case 's':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            openStatusModal();
          }
          break;
        case 'p':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            openPriorityModal();
          }
          break;
        case 'r':
          // Quick reply
          focusReplyInput();
          break;
        case 'Escape':
          closeAllModals();
          break;
      }
    };
    
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [ticket]);
};
```

### 5.4 Canned Responses / Quick Replies

```tsx
// Pre-saved response templates
interface CannedResponse {
  id: string;
  title: string;
  content: string;
  category: string;
  shortcuts?: string;
}

const CannedResponsePicker: React.FC<{
  onSelect: (content: string) => void;
}> = ({ onSelect }) => {
  const { responses } = useCannedResponses();
  
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Zap className="w-4 h-4" />
          Quick Reply
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search templates..." />
          <CommandList>
            <CommandGroup heading="Common Responses">
              {responses.map((response) => (
                <CommandItem
                  key={response.id}
                  onSelect={() => onSelect(response.content)}
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">{response.title}</p>
                    <p className="text-xs text-slate-500 line-clamp-1">
                      {response.content}
                    </p>
                  </div>
                  {response.shortcuts && (
                    <kbd className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      {response.shortcuts}
                    </kbd>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
```

### 5.5 Export & Reporting

```tsx
// Export tickets to various formats
const ExportMenu: React.FC<{ tickets: Ticket[] }> = ({ tickets }) => {
  const exportToCSV = () => {
    const csv = convertToCSV(tickets);
    downloadFile(csv, 'tickets-export.csv', 'text/csv');
  };
  
  const exportToExcel = async () => {
    const xlsx = await import('xlsx');
    const ws = xlsx.utils.json_to_sheet(formatTicketsForExport(tickets));
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Tickets');
    xlsx.writeFile(wb, 'tickets-export.xlsx');
  };
  
  const exportToPDF = async () => {
    const doc = await generatePDFReport(tickets);
    doc.save('tickets-report.pdf');
  };
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={exportToCSV}>
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToExcel}>
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Export as Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToPDF}>
          <FileText className="w-4 h-4 mr-2" />
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
```

---

## 6. Performance Optimizations

### 6.1 Image Optimization

```tsx
// Lazy loaded images with blur placeholder
const OptimizedImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
}> = ({ src, alt, className }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  
  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Blur placeholder */}
      {!isLoaded && !error && (
        <div className="absolute inset-0 bg-slate-200 dark:bg-slate-700 animate-pulse" />
      )}
      
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300",
          isLoaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={() => setIsLoaded(true)}
        onError={() => setError(true)}
      />
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800">
          <ImageOff className="w-8 h-8 text-slate-400" />
        </div>
      )}
    </div>
  );
};
```

### 6.2 Virtual Scrolling untuk Long Lists

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

const VirtualTicketList: React.FC<{ tickets: Ticket[] }> = ({ tickets }) => {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const rowVirtualizer = useVirtualizer({
    count: tickets.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });
  
  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <TicketRow ticket={tickets[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  );
};
```

### 6.3 Code Splitting

```tsx
// Lazy load heavy components
const ReportsPage = lazy(() => import('./features/reports/pages/BentoReportsPage'));
const KnowledgeBasePage = lazy(() => import('./features/knowledge-base/pages/BentoKnowledgeBasePage'));
const SettingsPage = lazy(() => import('./features/settings/pages/BentoSettingsPage'));

// With loading fallback
<Suspense fallback={<PageSkeleton />}>
  <ReportsPage />
</Suspense>
```

---

## 7. Mobile Experience

### 7.1 Bottom Navigation Bar
**File:** `apps/frontend/src/components/layout/MobileBottomNav.tsx`

```tsx
const MobileBottomNav: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  
  const navItems = [
    { icon: Home, label: 'Home', path: '/dashboard' },
    { icon: Ticket, label: 'Tickets', path: '/tickets/list' },
    { icon: Plus, label: 'Create', path: '/tickets/create', highlight: true },
    { icon: BookOpen, label: 'KB', path: '/kb' },
    { icon: User, label: 'Profile', path: '/settings' },
  ];
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-4 py-2 lg:hidden z-50 safe-area-pb">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          
          if (item.highlight) {
            return (
              <Link
                key={item.path}
                to={item.path}
                className="relative -top-4 w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/25"
              >
                <item.icon className="w-6 h-6 text-white" />
              </Link>
            );
          }
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-xl transition-colors",
                isActive 
                  ? "text-primary bg-primary/10" 
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
```

### 7.2 Swipe Actions
```tsx
// Swipeable ticket row for mobile
const SwipeableTicketRow: React.FC<{ ticket: Ticket }> = ({ ticket }) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  
  const handlers = useSwipeable({
    onSwiping: (e) => setSwipeOffset(e.deltaX),
    onSwipedLeft: () => {
      if (swipeOffset < -100) {
        // Show quick actions
        showActionsMenu();
      }
      setSwipeOffset(0);
    },
    onSwipedRight: () => {
      if (swipeOffset > 100) {
        // Mark as resolved
        resolveTicket(ticket.id);
      }
      setSwipeOffset(0);
    },
    trackMouse: false,
  });
  
  return (
    <div {...handlers} className="relative overflow-hidden">
      {/* Background actions */}
      <div className="absolute inset-y-0 left-0 w-24 bg-green-500 flex items-center justify-center">
        <Check className="w-6 h-6 text-white" />
      </div>
      <div className="absolute inset-y-0 right-0 w-24 bg-red-500 flex items-center justify-center">
        <Trash2 className="w-6 h-6 text-white" />
      </div>
      
      {/* Ticket content */}
      <div
        className="bg-white dark:bg-slate-800 transition-transform"
        style={{ transform: `translateX(${swipeOffset}px)` }}
      >
        <TicketRow ticket={ticket} />
      </div>
    </div>
  );
};
```

### 7.3 Pull to Refresh
```tsx
const PullToRefresh: React.FC<{ onRefresh: () => Promise<void> }> = ({ 
  onRefresh, 
  children 
}) => {
  const [isPulling, setIsPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  
  // Implementation with touch events
  // ...
  
  return (
    <div className="relative">
      {/* Refresh indicator */}
      <div 
        className={cn(
          "absolute top-0 left-0 right-0 flex items-center justify-center transition-all",
          isPulling ? "h-16" : "h-0"
        )}
      >
        <RefreshCw 
          className={cn(
            "w-6 h-6 text-primary transition-transform",
            isPulling && "animate-spin"
          )}
          style={{ 
            transform: `rotate(${pullProgress * 360}deg)`,
            opacity: pullProgress
          }}
        />
      </div>
      
      {children}
    </div>
  );
};
```

---

## 8. Accessibility

### 8.1 Keyboard Navigation
```tsx
// Focus trap for modals
const useFocusTrap = (isOpen: boolean, containerRef: RefObject<HTMLElement>) => {
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    
    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };
    
    container.addEventListener('keydown', handleKeyDown);
    firstElement?.focus();
    
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, containerRef]);
};
```

### 8.2 Skip Links
```tsx
// Skip to main content link
const SkipLink: React.FC = () => (
  <a
    href="#main-content"
    className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg"
  >
    Skip to main content
  </a>
);
```

### 8.3 Screen Reader Announcements
```tsx
// Live region for dynamic updates
const ScreenReaderAnnouncement: React.FC<{ message: string }> = ({ message }) => (
  <div
    role="status"
    aria-live="polite"
    aria-atomic="true"
    className="sr-only"
  >
    {message}
  </div>
);

// Usage
const [announcement, setAnnouncement] = useState('');

const handleTicketUpdate = (ticket: Ticket) => {
  updateTicket(ticket);
  setAnnouncement(`Ticket ${ticket.ticketNumber} status updated to ${ticket.status}`);
};
```

### 8.4 Color Contrast & Focus States
```css
/* High contrast focus states */
:focus-visible {
  outline: 2px solid hsl(var(--primary));
  outline-offset: 2px;
}

/* Ensure text contrast meets WCAG AA */
.text-contrast-safe {
  color: hsl(220 15% 20%); /* At least 4.5:1 contrast */
}

/* Reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 9. Implementation Priority

### Phase 1: Quick Wins (1-2 weeks)
| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Update Logo component | High | Low | High |
| Add page transitions | High | Low | High |
| Button hover effects | High | Low | Medium |
| Skeleton loading improvements | High | Low | Medium |
| Focus states & accessibility | High | Low | High |

### Phase 2: Core Improvements (2-4 weeks)
| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Global search command palette | High | Medium | High |
| Dashboard stats with sparklines | Medium | Medium | High |
| Ticket quick preview panel | High | Medium | High |
| Mobile bottom navigation | High | Medium | High |
| Canned responses system | Medium | Medium | High |

### Phase 3: Advanced Features (4-8 weeks)
| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Virtual scrolling for lists | Medium | High | Medium |
| Advanced filtering & saved views | Medium | High | High |
| Export functionality | Low | Medium | Medium |
| Real-time activity feed | Low | High | Medium |
| Chat reactions & threading | Low | High | Medium |

### Phase 4: Polish & Refinement (Ongoing)
| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Animation system refinement | Low | Medium | Medium |
| Color palette expansion | Low | Low | Low |
| Typography system | Low | Medium | Medium |
| Mobile swipe gestures | Low | High | Medium |
| Pull to refresh | Low | Medium | Low |

---

## 10. Technical Debt & Cleanup

### Files to Refactor
1. `BentoTicketListPage.tsx` - Extract components, reduce file size
2. `BentoDashboardPage.tsx` - Move chart components to separate files
3. `ticket-detail/*` - Consolidate duplicate logic

### Components to Create
1. `Logo.tsx` - Centralized logo component
2. `Sparkline.tsx` - Reusable mini chart
3. `QuickPreview.tsx` - Hover preview card
4. `MobileBottomNav.tsx` - Mobile navigation
5. `GlobalSearchCommand.tsx` - Command palette

### Dependencies to Add
```json
{
  "cmdk": "^0.2.0",          // Command palette
  "framer-motion": "^10.x",  // Animations
  "@tanstack/react-virtual": "^3.x", // Virtual lists
  "react-swipeable": "^7.x"  // Swipe gestures
}
```

---

## Summary

Dokumen ini mencakup **50+ improvement suggestions** yang dapat diimplementasikan secara bertahap:

- **Design System**: Color tokens, typography, spacing, gradients
- **UI/UX**: Dashboard enhancements, ticket improvements, KB updates
- **Animations**: Page transitions, micro-interactions, loading states
- **Branding**: New logo component, favicon, loading screens
- **Functionality**: Search, filters, exports, quick actions
- **Performance**: Lazy loading, virtual scrolling, code splitting
- **Mobile**: Bottom nav, swipe actions, pull to refresh
- **Accessibility**: Keyboard nav, screen reader, focus states

Implementasi mengikuti priority matrix untuk memastikan quick wins tercapai lebih dulu.
