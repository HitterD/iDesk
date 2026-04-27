const fs = require('fs');

function applyChanges() {
  // 1. ZoomCalendarGrid.tsx
  let grid = fs.readFileSync('apps/frontend/src/features/zoom-booking/components/ZoomCalendarGrid.tsx', 'utf8');

  grid = grid.replace(
    /\{\s*slot\?.status === 'available' && canBook && \(\s*<div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">\s*<Plus className="h-4 w-4 text-emerald-500\/60" \/>\s*<\/div>\s*\)\s*\}/g,
    `{slot?.status === 'available' && canBook && (
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 border border-dashed border-blue-400/70 rounded-lg m-0.5 bg-blue-50/50 dark:bg-blue-950/30">
                                                <span className="text-xs font-medium text-blue-500 dark:text-blue-400 flex items-center gap-1">
                                                    <Plus className="h-3 w-3" /> Book {time}
                                                </span>
                                            </div>
                                        )}`
  );

  grid = grid.replace(
    /className=\{\s*cn\(\s*'p-1.5 grid-separator-v text-center flex items-center justify-center sticky left-0 z-10 transition-colors',\s*hourStart\s*\?\s*'bg-slate-100 dark:bg-slate-800 grid-separator-h-strong text-xs font-semibold text-foreground'\s*:\s*'bg-slate-50 dark:bg-slate-800\/95 grid-separator-h text-\[11px\] text-muted-foreground'\s*\)\s*\}/g,
    `className={cn(
                                    'pr-3 flex items-start justify-end sticky left-0 z-10 transition-colors border-r border-slate-200 dark:border-slate-700',
                                    hourStart
                                        ? 'text-xs font-bold text-slate-700 dark:text-slate-300 -mt-2'
                                        : 'text-[10px] text-slate-300 dark:text-slate-600 -mt-1.5'
                                )}`
  );

  grid = grid.replace(
    /\{day.isBlocked && \(\s*<span className="text-\[10px\] text-red-500 font-medium bg-red-500\/10 px-2 py-0.5 rounded-full mt-1 inline-block">\s*Blocked\s*<\/span>\s*\)\s*\}/g,
    `{(() => {
                                const meetingCount = new Set(day.slots.filter(s => s.booking).map(s => s.booking!.id)).size;
                                return meetingCount > 0 && (
                                    <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30">
                                        {meetingCount} meetings
                                    </span>
                                );
                            })()}
                            {day.isBlocked && (
                                <span className="text-[10px] text-red-500 font-medium bg-red-500/10 px-2 py-0.5 rounded-full mt-1 inline-block">
                                    Blocked
                                </span>
                            )}`
  );

  grid = grid.replace(
    /const dayIsToday = isToday\(new Date\(day.date\)\);\s*return \(\s*<div\s*key=\{day.date\}\s*className=\{cn\(\s*'p-3 grid-separator-h text-center transition-colors sticky top-0 z-20',\s*dayIsToday\s*\?\s*'bg-blue-50 dark:bg-blue-950\/30 border-b-2 border-b-primary'\s*:\s*'bg-slate-50 dark:bg-slate-800\/90',\s*!day.isWorkingDay && 'opacity-70'\s*\)\s*\}/g,
    `const dayDate = new Date(day.date);
                    const dayIsToday = isToday(dayDate);
                    const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
                    return (
                        <div
                            key={day.date}
                            className={cn(
                                'p-3 grid-separator-h text-center transition-colors sticky top-0 z-20',
                                dayIsToday
                                    ? 'bg-blue-50 dark:bg-blue-950/30 border-b-2 border-b-primary'
                                    : 'bg-slate-50 dark:bg-slate-800/90',
                                !day.isWorkingDay && 'opacity-70',
                                isWeekend && 'bg-slate-100/80 dark:bg-slate-800/40 opacity-60'
                            )}`
  );

  grid = grid.replace(
    /'ring-2 ring-inset ring-blue-500 z-10'\s*\)\s*\}\s*onClick=\{\(\) => onSlotClick\(day, timeIndex\)\}\s*title=\{/g,
    `'ring-2 ring-inset ring-blue-500 z-10',\
                                            (new Date(day.date).getDay() === 0 || new Date(day.date).getDay() === 6) && 'bg-slate-100/80 dark:bg-slate-800/40 opacity-60 cursor-not-allowed'
                                        )}
                                        onClick={() => {
                                            const isWeekend = new Date(day.date).getDay() === 0 || new Date(day.date).getDay() === 6;
                                            if (!isWeekend) onSlotClick(day, timeIndex);
                                        }}
                                        title={`
  );

  grid = grid.replace(
    /style=\{\{\s*cursor: slot\?.status === 'available' && !canBook \? 'not-allowed' : undefined\s*\}\}/g,
    `style={{
                                            cursor: (new Date(day.date).getDay() === 0 || new Date(day.date).getDay() === 6) || (slot?.status === 'available' && !canBook) ? 'not-allowed' : undefined
                                        }}`
  );

  fs.writeFileSync('apps/frontend/src/features/zoom-booking/components/ZoomCalendarGrid.tsx', grid);

  // 2. ZoomWeekView.tsx
  let week = fs.readFileSync('apps/frontend/src/features/zoom-booking/components/ZoomWeekView.tsx', 'utf8');

  week = week.replace(
    /\{calDay\?.isBlocked && \(\s*<span className="text-\[9px\] text-red-500 font-medium bg-red-50 dark:bg-red-950\/30 px-1 rounded">Blokir<\/span>\s*\)\s*\}/g,
    `{(() => {
                                const meetingCount = calDay ? new Set(calDay.slots.filter(s => s.booking).map(s => s.booking!.id)).size : 0;
                                return meetingCount > 0 && (
                                    <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30">
                                        {meetingCount} meetings
                                    </span>
                                );
                            })()}
                            {calDay?.isBlocked && (
                                <span className="text-[9px] text-red-500 font-medium bg-red-50 dark:bg-red-950/30 px-1 rounded">Blokir</span>
                            )}`
  );

  week = week.replace(
    /className=\{\s*cn\(\s*"sticky left-0 z-10 flex items-center justify-end pr-2 text-\[11px\] border-r border-slate-200 dark:border-slate-700",\s*isHour\s*\?\s*"bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 border-b border-b-slate-300 dark:border-b-slate-600"\s*:\s*"bg-slate-50 dark:bg-slate-800\/80 text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-700"\s*\)\s*\}/g,
    `className={cn(
                                    "sticky left-0 z-10 flex items-start justify-end pr-3 border-r border-slate-200 dark:border-slate-700",
                                    isHour
                                        ? "text-xs font-bold text-slate-700 dark:text-slate-300 -mt-2"
                                        : "text-[10px] text-slate-300 dark:text-slate-600 -mt-1.5"
                                )}`
  );
  
  week = week.replace(
    /\{isHour \? time : <span className="opacity-70">\{time\}<\/span>\}/g,
    `{isHour ? time : <span className="opacity-75">{time}</span>}`
  );

  week = week.replace(
    /className=\{\s*cn\(\s*"border-b border-r border-slate-200 dark:border-slate-700",\s*isHour && "border-b-slate-300 dark:border-b-slate-600",\s*today && "bg-blue-50\/30 dark:bg-blue-950\/10",\s*slot \? SLOT_BG\[slot\.status as keyof typeof SLOT_BG\] : "bg-slate-50\/50 dark:bg-slate-800\/20"\s*\)\s*\}\s*style=\{\{ height: SLOT_HEIGHT \}\}\s*onClick=\{\(\) => calDay && onSlotClick\(calDay, timeIndex\)\}\s*\/>/g,
    `className={cn(
                                            "border-b border-r border-slate-200 dark:border-slate-700 relative group",
                                            isHour && "border-b-slate-300 dark:border-b-slate-600",
                                            today && "bg-blue-50/30 dark:bg-blue-950/10",
                                            slot ? SLOT_BG[slot.status as keyof typeof SLOT_BG] : "bg-slate-50/50 dark:bg-slate-800/20",
                                            (day.getDay() === 0 || day.getDay() === 6) && 'bg-slate-100/80 dark:bg-slate-800/40 opacity-60 cursor-not-allowed'
                                        )}
                                        style={{ height: SLOT_HEIGHT }}
                                        onClick={() => {
                                            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                                            if (calDay && !isWeekend) onSlotClick(calDay, timeIndex);
                                        }}
                                    >
                                        {slot?.status === 'available' && canBook && (
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 border border-dashed border-blue-400/70 rounded-lg m-0.5 bg-blue-50/50 dark:bg-blue-950/30 z-10 pointer-events-none">
                                                <span className="text-[10px] font-medium text-blue-500 dark:text-blue-400 flex items-center gap-1">
                                                    <Video className="h-3 w-3" /> Book {time}
                                                </span>
                                            </div>
                                        )}
                                    </div>`
  );

  fs.writeFileSync('apps/frontend/src/features/zoom-booking/components/ZoomWeekView.tsx', week);

  // 3. ZoomDayView.tsx
  let dayView = fs.readFileSync('apps/frontend/src/features/zoom-booking/components/ZoomDayView.tsx', 'utf8');

  dayView = dayView.replace(
    /className=\{\s*cn\(\s*"sticky left-0 z-10 flex items-center justify-end pr-2 text-\[11px\] border-r border-slate-200 dark:border-slate-700",\s*isHour\s*\?\s*"bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 border-b border-b-slate-300 dark:border-b-slate-600"\s*:\s*"bg-slate-50 dark:bg-slate-800\/80 text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-700"\s*\)\s*\}/g,
    `className={cn(
                                        "sticky left-0 z-10 flex items-start justify-end pr-3 border-r border-slate-200 dark:border-slate-700",
                                        isHour
                                            ? "text-xs font-bold text-slate-700 dark:text-slate-300 -mt-2"
                                            : "text-[10px] text-slate-300 dark:text-slate-600 -mt-1.5"
                                    )}`
  );

  dayView = dayView.replace(
    /\{isHour \? time : <span className="opacity-70">\{time\}<\/span>\}/g,
    `{isHour ? time : <span className="opacity-75">{time}</span>}`
  );

  dayView = dayView.replace(
    /className=\{\s*cn\(\s*"border-b border-slate-200 dark:border-slate-700",\s*isHour && "border-b-slate-300 dark:border-b-slate-600",\s*slot \? SLOT_BG\[slot\.status as keyof typeof SLOT_BG\] : "bg-white dark:bg-slate-900"\s*\)\s*\}\s*style=\{\{ height: SLOT_HEIGHT \}\}\s*onClick=\{\(\) => calDay && onSlotClick\(calDay, timeIndex\)\}\s*\/>/g,
    `className={cn(
                                        "border-b border-slate-200 dark:border-slate-700 relative group",
                                        isHour && "border-b-slate-300 dark:border-b-slate-600",
                                        slot ? SLOT_BG[slot.status as keyof typeof SLOT_BG] : "bg-white dark:bg-slate-900",
                                        (currentDate.getDay() === 0 || currentDate.getDay() === 6) && 'bg-slate-100/80 dark:bg-slate-800/40 opacity-60 cursor-not-allowed'
                                    )}
                                    style={{ height: SLOT_HEIGHT }}
                                    onClick={() => {
                                        const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
                                        if (calDay && !isWeekend) onSlotClick(calDay, timeIndex);
                                    }}
                                >
                                    {slot?.status === 'available' && canBook && (
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 border border-dashed border-blue-400/70 rounded-lg m-0.5 bg-blue-50/50 dark:bg-blue-950/30 z-10 pointer-events-none">
                                            <span className="text-[10px] font-medium text-blue-500 dark:text-blue-400 flex items-center gap-1">
                                                <Video className="h-3 w-3" /> Book {time}
                                            </span>
                                        </div>
                                    )}
                                </div>`
  );

  fs.writeFileSync('apps/frontend/src/features/zoom-booking/components/ZoomDayView.tsx', dayView);

  // 4. ZoomMonthView.tsx
  let month = fs.readFileSync('apps/frontend/src/features/zoom-booking/components/ZoomMonthView.tsx', 'utf8');

  month = month.replace(
    /\{DAY_NAMES\.map\(\(name\) => \(\s*<div\s*key=\{name\}\s*className="py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400"\s*>\s*\{name\}\s*<\/div>\s*\)\)\}/g,
    `{DAY_NAMES.map((name, idx) => (
                    <div
                        key={name}
                        className={cn(
                            "py-2 text-center text-xs font-semibold",
                            idx >= 5
                                ? "text-slate-400/70 dark:text-slate-500/70"
                                : "text-slate-500 dark:text-slate-400"
                        )}
                    >
                        {name}
                    </div>
                ))}`
  );

  month = month.replace(
    /const overflow = events.length - visibleEvents.length;\s*const isBlocked = calDay\?.isBlocked \?\? false;\s*return \(\s*<div\s*key=\{dateStr\}\s*className=\{cn\(\s*"min-h-\[80px\] p-1 border-b border-r border-slate-200 dark:border-slate-700",\s*"cursor-pointer transition-colors duration-100 relative",\s*inMonth\s*\?\s*"bg-white dark:bg-slate-900 hover:bg-slate-50\/80 dark:hover:bg-slate-800\/60 hover:shadow-inner"\s*:\s*"bg-slate-50\/40 dark:bg-slate-800\/20",\s*today && "bg-blue-50\/60 dark:bg-blue-950\/20",\s*isBlocked && "bg-red-50\/40 dark:bg-red-950\/20"\s*\)\s*\}\s*onClick=\{\(\) => \{\s*if \(calDay && calDay.slots.length > 0\) \{\s*onSlotClick\(calDay, calDay.slots\[0\]\);\s*\}\s*\}\}/g,
    `const overflow = events.length - visibleEvents.length;
                    const isBlocked = calDay?.isBlocked ?? false;
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                    return (
                        <div
                            key={dateStr}
                            className={cn(
                                "min-h-[80px] p-1 border-b border-r border-slate-200 dark:border-slate-700",
                                "transition-colors duration-100 relative",
                                !isWeekend && "cursor-pointer",
                                inMonth
                                    ? "bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/60 hover:shadow-inner"
                                    : "bg-slate-50/40 dark:bg-slate-800/20",
                                today && "bg-blue-50/60 dark:bg-blue-950/20",
                                isBlocked && "bg-red-50/40 dark:bg-red-950/20",
                                isWeekend && "bg-slate-100/80 dark:bg-slate-800/40 cursor-not-allowed opacity-60 hover:bg-slate-100/80 dark:hover:bg-slate-800/40"
                            )}
                            onClick={() => {
                                if (isWeekend) return;
                                if (calDay && calDay.slots.length > 0) {
                                    onSlotClick(calDay, calDay.slots[0]);
                                }
                            }}`
  );

  month = month.replace(
    /<span className=\{cn\(\s*"text-xs font-semibold inline-flex items-center justify-center w-6 h-6 rounded-full",\s*today\s*\?\s*"bg-blue-600 text-white"\s*:\s*inMonth\s*\?\s*"text-slate-800 dark:text-slate-200"\s*:\s*"text-slate-400 dark:text-slate-600"\s*\)\}>\s*\{format\(day, 'd'\)\}\s*<\/span>\s*\{isBlocked && \(\s*<span className="text-\[9px\] text-red-500 font-medium">Blokir<\/span>\s*\)\s*\}/g,
    `<div className="flex items-center gap-1">
                                    <span className={cn(
                                        "text-xs font-semibold inline-flex items-center justify-center w-6 h-6 rounded-full",
                                        today
                                            ? "bg-blue-600 text-white"
                                            : inMonth
                                                ? "text-slate-800 dark:text-slate-200"
                                                : "text-slate-400 dark:text-slate-600"
                                    )}>
                                        {format(day, 'd')}
                                    </span>
                                    {events.length > 0 && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30">
                                            {events.length} meetings
                                        </span>
                                    )}
                                </div>
                                {isBlocked && (
                                    <span className="text-[9px] text-red-500 font-medium">Blokir</span>
                                )}`
  );

  fs.writeFileSync('apps/frontend/src/features/zoom-booking/components/ZoomMonthView.tsx', month);
  console.log('Update complete.');
}

applyChanges();