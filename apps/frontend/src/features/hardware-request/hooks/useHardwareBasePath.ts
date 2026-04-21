import { useLocation } from 'react-router-dom';

/**
 * Custom hook to resolve the base path for hardware request links
 * depending on which portal the user is currently accessing.
 * 
 * - Client portal: /client/hardware-requests
 * - Manager portal: /manager/hardware-requests
 * - Admin/Agent portal: /hardware-requests
 */
export function useHardwareBasePath(): string {
  const location = useLocation();
  
  if (location.pathname.startsWith('/client/')) {
    return '/client/hardware-requests';
  }
  
  if (location.pathname.startsWith('/manager/')) {
    return '/manager/hardware-requests';
  }
  
  return '/hardware-requests';
}
