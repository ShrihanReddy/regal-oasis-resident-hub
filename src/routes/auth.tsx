import { createFileRoute, Link } from '@tanstack/react-router';
import { OwnerPanel } from '@/components/owner-panel';
export const Route = createFileRoute('/auth')({ head: () => ({ meta: [
  { title: 'Owner Sign In | THE REGAL OASIS' }, { name: 'description', content: 'Secure owner access to The Regal Oasis accommodation and mess management.' }, { property: 'og:title', content: 'Owner Sign In | THE REGAL OASIS' }, { property: 'og:description', content: 'Secure owner access to The Regal Oasis.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
] }), component: Auth });
function Auth() { return <div className="site-shell"><div className="auth-back"><Link to="/">← Back to The Regal Oasis</Link></div><OwnerPanel /></div>; }
