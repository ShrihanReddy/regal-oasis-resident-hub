import { useState, type FormEvent } from 'react';
import { ShieldCheck, ArrowRight, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import '@lovable.dev/cloud-auth-js/styles.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function OwnerSignIn() {
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const { error } = signup ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } }) : await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
      else if (signup) setMessage('Check your email to confirm your account, then sign in.');
    } catch { setMessage('Sign-in is unavailable. Please try again.'); }
    finally { setBusy(false); }
  }
  async function social(provider: 'google' | 'lovable') {
    setBusy(true); setMessage('');
    try { const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin }); if (result.error) setMessage(result.error.message); } catch { setMessage('Sign-in could not be started. Please try again.'); } finally { setBusy(false); }
  }
  async function reset() {
    if (!email) { setMessage('Enter your email address first.'); return; }
    setBusy(true);
    try { const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }); setMessage(error ? error.message : 'Check your email for a password reset link.'); } catch { setMessage('Could not send the reset email. Please try again.'); } finally { setBusy(false); }
  }
  return <section className="owner-auth">
    <div className="auth-icon"><ShieldCheck size={28} /></div>
    <p className="small-label">THE REGAL OASIS / OWNER ACCESS</p>
    <h1>{signup ? 'Create your account' : 'Welcome back.'}</h1>
    <p className="auth-intro">Sign in to manage your accommodation rents and mess menu.</p>
    <div className="auth-form">
      <Button variant="outline" onClick={() => social('google')} disabled={busy}>Continue with Google <ArrowRight size={16} /></Button>
      <Button className="lovable-auth-button" onClick={() => social('lovable')} disabled={busy}>Continue with Lovable</Button>
      <div className="auth-divider">or use your email</div>
      <form onSubmit={submit}>
        <label htmlFor="owner-email">Email address</label><Input id="owner-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
        <label htmlFor="owner-password">Password</label><Input id="owner-password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={8} value={password} onChange={e => setPassword(e.target.value)} required />
        <Button type="submit" disabled={busy}>{busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}<ArrowRight size={16} /></Button>
      </form>
      {message && <p className="form-message" role="status">{message}</p>}
      <div className="auth-actions"><Button variant="link" onClick={() => { setSignup(!signup); setMessage(''); }}>{signup ? 'Already have an account? Sign in' : 'First time? Create an account'}</Button><Button variant="link" onClick={reset} disabled={busy}>Forgot password?</Button></div>
      <p className="owner-boundary"><Mail size={14} />Editing is restricted to the verified owner account.</p>
    </div>
  </section>;
}
