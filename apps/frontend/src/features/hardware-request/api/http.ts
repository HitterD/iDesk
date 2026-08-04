import axios from 'axios';

export const hrHttp = axios.create({
    baseURL: `${import.meta.env.VITE_API_URL || ''}/v1/hardware-requests`,
    withCredentials: true,
});

hrHttp.interceptors.response.use(
    (r) => r,
    (err) => {
        const code = err?.response?.data?.error;
        const msg = err?.response?.data?.message ?? code ?? err.message;
        const enriched = new Error(msg);
        (enriched as any).code = code;
        (enriched as any).status = err?.response?.status;
        (enriched as any).response = err?.response;
        return Promise.reject(enriched);
    },
);
