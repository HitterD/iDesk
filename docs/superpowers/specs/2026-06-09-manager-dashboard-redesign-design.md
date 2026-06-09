# Design Specification: Manager Dashboard Bento Redesign

## 1. Purpose & Scope
**Problem:** The current Manager Dashboard (`ManagerDashboard.tsx`) looks generic, with a standard top-to-bottom layout that fails to prioritize critical operational data effectively.
**Goal:** Redesign the dashboard to be highly user-friendly and aesthetically aligned with iDesk's premium "Bento UI" admin style, emphasizing clear information hierarchy and modern, clean components.
**Target File:** `apps/frontend/src/features/manager/pages/ManagerDashboard.tsx`

## 2. Aesthetic Direction
**Style:** Editorial / Magazine (Structured Bento)
- **Palette:** Utilize native CSS variables `hsl(var(--card))` and `hsl(var(--border))` for native dark-mode compatibility. Use subtle accents and bold typography.
- **Motion:** Subtle entrance animations (`animate-fade-in-up`) for all top-level components.
- **Composition:** Asymmetric split layout (60/40) for a dynamic visual flow. Generous padding for breathing room.

## 3. Architecture & Data Flow
No changes to the API or data layer. All existing data models and endpoints (`/manager/dashboard`) remain untouched. The change is purely presentational.

## 4. Component Layout Details

### 4.1 Header Area
- Page title and description grouped.
- Site Selector and Refresh Button grouped inside a unified action bar, adopting the design language of `BentoAdminAgentsPage.tsx`.

### 4.2 Left Column: "The Big Picture" (60% Width)
- **Executive Metrics Grid:** A 2x2 grid housing the 4 key metrics (Total Tickets, Open Tickets, Critical, SLA Breach). Each metric is a separate Bento card with rounded corners and a minimalist icon.
- **Trend Line Chart:** Spans the full width of the left column beneath the metrics grid. Provides a clear 7-day trend analysis.

### 4.3 Right Column: "Action Center" (40% Width)
- **Site Distribution Bar Chart:** Compressed into a smaller Bento card at the top right.
- **Recent Critical Tickets (Feed):** The standard table is replaced by a modern activity feed list. Each item displays a status dot (red for critical), ticket number, title, and a "time ago" string.
- **Top Agents (Compact List):** The table is replaced by a compact list featuring initial avatars (e.g., `A` in a small square), agent name, and their resolution count, identical to the `AdminWorkloadDashboard.tsx` style.

## 5. Anti-Patterns to Avoid
- **Generic Tables:** Do not use the standard `<Table>` component for "Top Agents" or "Recent Critical" as it wastes horizontal space and feels rigid. Use customized flex lists.
- **Cluttered Colors:** Do not use bright solid colors for backgrounds unless necessary for critical alerts. Rely on `bg-[hsl(var(--card))]` with colored text accents.
- **Symmetric Grids:** Avoid standard 50/50 splits. Embrace the 60/40 or 65/35 asymmetric layout for better visual hierarchy.
