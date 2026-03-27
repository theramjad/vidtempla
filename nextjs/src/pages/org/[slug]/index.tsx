/**
 * Org-scoped index page
 * Redirects to the YouTube dashboard
 */

import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function OrgIndexPage() {
  const router = useRouter();
  const { slug } = router.query;

  useEffect(() => {
    if (slug) {
      router.replace(`/org/${slug}/dashboard/youtube`);
    }
  }, [slug, router]);

  return null;
}
