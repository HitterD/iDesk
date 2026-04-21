export const getAttachmentUrl = (url: string) => {
    // Skip invalid Telegram file ID formats (legacy data)
    if (url.startsWith('telegram:photo:') || url.startsWith('telegram:document:')) {
        console.warn('Legacy Telegram attachment format detected:', url);
        return ''; // Return empty to hide broken attachments
    }
    
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5050';
    return `${backendUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};

export const isImageUrl = (url: string) => {
    // Skip invalid Telegram file ID formats
    if (url.startsWith('telegram:')) {
        return false;
    }
    
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    const lowerUrl = url.toLowerCase();
    return imageExtensions.some(ext => lowerUrl.includes(ext)) || lowerUrl.includes('/uploads/telegram/');
};
