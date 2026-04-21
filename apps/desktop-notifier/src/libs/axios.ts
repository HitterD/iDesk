import axios from 'axios'

// Create axios instance
// TODO: Replace localhost with env variable
export const api = axios.create({
    baseURL: 'http://localhost:3000',
    withCredentials: true, // Send cookies
    headers: {
        'Content-Type': 'application/json',
    },
})

// Add response interceptor for global error handling if needed
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Check if 401 and redirect to login logic
        return Promise.reject(error)
    }
)
