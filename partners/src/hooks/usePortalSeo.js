import { useLocation } from 'react-router-dom';
import useSeo from '@shared/hooks/useSeo';

/**
 * Route-level SEO for the partner portal.
 *
 * The public pages (landing, FAQ, join, register) call `useSeo` themselves with
 * copy written for a search result. Everything behind the route guard — the
 * merchant workspace, the rider console and the operations desk — is private
 * account data, so it gets one generic title and is marked `noindex` from a
 * single place rather than being repeated in each page.
 */
const PRIVATE_ROUTES = {
  '/profile': 'My Profile',
  '/dashboard': 'Partner Dashboard',
  '/shop-setup': 'Shop Setup',
  '/products': 'My Products',
  '/orders': 'Shop Orders',
  '/rider': 'Rider Console',
  '/admin/orders': 'Orders — Operations',
  '/admin/products': 'Products — Operations',
  '/admin/partners': 'Partners — Operations',
  '/admin/delivery': 'Delivery — Operations',
};

export function usePortalSeo() {
  const { pathname } = useLocation();
  const section = PRIVATE_ROUTES[pathname];

  // Always call the hook: on a public route there is nothing to set, so pass
  // empty values and let that page's own useSeo own the tags.
  useSeo(
    section
      ? {
          title: `${section} — OnlineKirana Partners`,
          description: `Private partner workspace on OnlineKirana: ${section.toLowerCase()}. Sign in to continue.`,
          noindex: true,
        }
      : {}
  );
}

export default usePortalSeo;
