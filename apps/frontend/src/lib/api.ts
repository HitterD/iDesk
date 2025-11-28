import axios from 'axios';
import { toast } from 'sonner';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5050',
    timeout: 30000, // Increased for file uploads
});

// Request Interceptor
api.interceptors.request.use(
    (config) => {
        const storage = localStorage.getItem('auth-storage');
        if (storage) {
            try {
                const { state } = JSON.parse(storage);
                if (state && state.token) {
                    config.headers.Authorization = `Bearer ${state.token}`;
                }
            } catch (error) {
                console.error('Error parsing auth storage:', error);
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response Interceptor
api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        const { response } = error;

        if (response) {
            // Handle 401 Unauthorized
            if (response.status === 401) {
                localStorage.removeItem('auth-storage');
                window.location.href = '/login';
                toast.error('Session expired. Please login again.');
                return Promise.reject(error);
            }

            // Handle other errors
            const message = response.data?.message || 'An unexpected error occurred';
            // If message is array (class-validator), join them
            const displayMessage = Array.isArray(message) ? message.join(', ') : message;

            toast.error(displayMessage);
        } else {
            // Network error or no response
            toast.error('Network error. Please check your connection.');
        }

        return Promise.reject(error);
    }
);

export default api;
