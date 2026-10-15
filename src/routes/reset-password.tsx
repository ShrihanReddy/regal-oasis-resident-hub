import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
export const Route = createFileRoute('/reset-password')({ head: () => ({ meta: [
 { title: 'Reset Password | THE REGAL OASIS' }, { name: 'description', content: 'Set a new password for your Regal Oasis account.' }, { property: 'og:title', content: 'Reset Password | THE REGAL OASIS' }, { property: 'og:description', content: 'Securely reset your Regal Oasis password.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
] }), component: ResetPassword });
function ResetPassword() {
 const [recovery, setRecovery] = useState(false); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const navigate = useNavigate();
 useEffect(() => { setRecovery(new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery'); }, []);
 async function submit(e: FormEvent) { e.preventDefault(); if (password !== confirm) { setMessage('Passwords do not match.'); return; } setBusy(true); try { const { error } = await supabase.auth.updateUser({ password }); if (error) setMessage(error.message); else await navigate({ to: '/auth' }); } catch { setMessage('Could not reset your password. Please try again.'); } finally { setBusy(false); } }
 return <section className="owner-auth"><h1>Set a new password</h1>{!recovery ? <p>This reset link is invalid or expired. <Link to="/auth">Request a new link.</Link></p> : <form className="auth-form" onSubmit={submit}><label htmlFor="new-password">New password</label><Input id="new-password" type="password" minLength={8} autoComplete="new-password" required value={password} onChange={e => setPassword(e.target.value)} /><label htmlFor="confirm-password">Confirm password</label><Input id="confirm-password" type="password" minLength={8} required value={confirm} onChange={e => setConfirm(e.target.value)} /><Button disabled={busy} type="submit">{busy ? 'Saving…' : 'Save password'}</Button>{message && <p role="status">{message}</p>}</form>}</section>;
}
