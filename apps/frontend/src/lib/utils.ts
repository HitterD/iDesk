import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatDate(dateString: string | Date | undefined | null) {
    if (!dateString) return 'N/A';
    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'short',
        timeStyle: 'medium',
        timeZone: 'Asia/Jakarta'
    }).format(new Date(dateString));
}
