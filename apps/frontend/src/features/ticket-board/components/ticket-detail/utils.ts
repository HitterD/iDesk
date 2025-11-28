export const getAttachmentUrl = (url: string) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5050';
    return `${backendUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};

export const isImageUrl = (url: string) => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    const lowerUrl = url.toLowerCase();
    return imageExtensions.some(ext => lowerUrl.includes(ext)) || lowerUrl.includes('/uploads/telegram/');
};
