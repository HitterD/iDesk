import axios from 'axios';

export interface LoginError {
  type: 'error' | 'warning' | 'info';
  message: string;
  details?: string;
  errorCode?: string;
}

const MAX_LOGIN_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_SECONDS = 60;

export const getErrorFromResponse = (err: unknown, currentAttempts: number): LoginError => {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const data = err.response?.data;
    const message = data?.message;
    const errorCode = data?.errorCode;

    if (!err.response) {
      return { type: 'error', message: 'Unable to connect to server', details: 'Please check your internet connection and try again.' };
    }

    if (errorCode) {
      switch (errorCode) {
        case 'USER_NOT_FOUND':
          return { type: 'error', message: 'Account not found', details: 'No account exists with this email address.', errorCode };
        case 'WRONG_PASSWORD': {
          const remainingAttempts = MAX_LOGIN_ATTEMPTS - currentAttempts - 1;
          return {
            type: 'error',
            message: 'Incorrect password',
            details: remainingAttempts > 0
              ? `${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`
              : 'This is your last attempt!',
            errorCode,
          };
        }
        case 'ACCOUNT_DISABLED':
          return { type: 'error', message: 'Account suspended', details: 'Please contact the system administrator.', errorCode };
      }
    }

    switch (status) {
      case 400:
        return { type: 'error', message: 'Invalid request', details: Array.isArray(message) ? message.join(', ') : message };
      case 401:
        return { type: 'error', message: message || 'Authentication failed', details: 'Check your credentials.' };
      case 403:
        return { type: 'error', message: 'Access denied', details: 'Clearance required.' };
      case 423:
        return { type: 'warning', message: 'Security lock active', details: 'Too many attempts. Wait 15 minutes.' };
      case 429:
        return { type: 'warning', message: 'Rate limit exceeded', details: `Wait ${RATE_LIMIT_WINDOW_SECONDS} seconds.` };
      case 500: case 502: case 503:
        return { type: 'error', message: 'Server unavailable', details: 'System offline. Try again later.' };
      default:
        return { type: 'error', message: message || 'Login failed', details: 'An unexpected error occurred.' };
    }
  }
  return { type: 'error', message: 'Authentication Error', details: 'System malfunction. Please retry.' };
};
