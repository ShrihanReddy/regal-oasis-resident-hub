import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useNavigate } from '@tanstack/react-router';
import { LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from './auth-context';
import { OwnerSignIn } from './owner-sign-in';
import { GuestSections } from './guest-sections';
import { HomepageCustomization } from './homepage-customization';
import { ResidentDirectory } from './resident-directory';
import { RentalLedger } from './rental-ledger';
import { KitchenInventory } from './kitchen-inventory';
import { ResidentInbox } from './resident-inbox';
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
    {access.isPending ? <div className="owner-status">Verifying owner access…</div> : access.isError ? <div className="owner-status" role="alert">Could not verify your access.<Button variant="outline" onClick={() => access.refetch()}>Try again</Button></div> : !access.data?.isOwner ? <div className="owner-status"><ShieldCheck size={28} /><h2>Owner access only</h2><p>This account cannot edit rents or meals. Sign in with the designated owner account.</p></div> : <>
      <nav aria-label="Owner dashboard sections" className="owner-quick-nav">
        {([['homepage-admin','Homepage'],['resident-admin','Residents'],['complaints-admin','Complaints'],['rental-admin','Rental Ledger'],['kitchen-admin','Food Inventory'],['accommodation-admin','Room Pricing'],['menu-admin','Mess Menu'],['gallery-admin','Photo Gallery']] as const).map(([id,name]) => <a key={id} href={'#'+id}>{name}</a>)}
      </nav>
      <div id="homepage-admin" className="owner-anchor"><HomepageCustomization /></div>
      <div id="resident-admin" className="owner-anchor"><ResidentDirectory /></div>
      <div id="complaints-admin" className="owner-anchor"><ResidentInbox /></div>
      <div id="rental-admin" className="owner-anchor"><RentalLedger /></div>
      <div id="kitchen-admin" className="owner-anchor"><KitchenInventory /></div>
      <div className="owner-section-scope"><GuestSections editable /></div>
    </>}
  </>;
}
