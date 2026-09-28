import { useLocation } from 'react-router-dom';

/**
 * Resolve the E-Form Access base path for the portal the user is currently in.
 *
 * - Client portal: /client/eform-access
 * - Manager portal: /manager/eform-access
 * - Admin/Agent portal: /eform-access
 *
 * Any other prefix has no matching route and falls through to the role-based
 * redirect (My Tickets / Dashboard), which is what broke the approval button.
 */
export function useEformBasePath(): string {
  const location = useLocation();

  if (location.pathname.startsWith('/client/')) {
    return '/client/eform-access';
  }

  if (location.pathname.startsWith('/manager/')) {
    return '/manager/eform-access';
  }

  return '/eform-access';
}
