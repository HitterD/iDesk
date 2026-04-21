export const formatZoomAccountName = (name?: string): string => {
    if (!name) return 'Zoom';
    // Extracts "Zoom 1", "Zoom 2", etc. regardless of preceding or succeeding text
    const match = name.match(/zoom\s*\d+/i);
    if (match) {
        // Capitalize properly: "Zoom X"
        const text = match[0];
        return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    }
    return name;
};
