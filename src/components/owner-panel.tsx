import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useNavigate } from '@tanstack/react-router';
import { LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from './auth-context';
import { OwnerSignIn } from './owner-sign-in';
import { GuestSections } from './guest-sections';
import { Button } from './ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getOwnerAccess } from '@/lib/guest.functions';
export function OwnerPanel() {
  const { user, ready } = useAuth();
  const check = useServerFn(getOwnerAccess);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const access = useQuery({ queryKey: ['owner-access', user?.id], queryFn: () => check(), enabled: !!user, retry: false });
  async function signOut() { await queryClient.cancelQueries(); queryClient.clear(); await supabase.auth.signOut(); await navigate({ to: '/auth', replace: true }); }
  if (!ready) return <section className="owner-status">Checking your account…</section>;
  if (!user) return <OwnerSignIn />;
  return <>
    <section className="owner-heading"><div><p className="small-label">PRIVATE / OWNER ADMIN</p><h1>Your oasis, your way.</h1><p className="signed-in-email">{user.email}</p></div><Button variant="outline" onClick={signOut}><LogOut />Sign out</Button></section>
    {access.isPending ? <div className="owner-status">Verifying owner access…</div> : access.isError ? <div className="owner-status" role="alert">Could not verify your access.<Button variant="outline" onClick={() => access.refetch()}>Try again</Button></div> : !access.data?.isOwner ? <div className="owner-status"><ShieldCheck size={28} /><h2>Owner access only</h2><p>This account cannot edit rents or meals. Sign in with the designated owner account.</p></div> : <GuestSections editable />}
  </>;
}
