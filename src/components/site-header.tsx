import { Building2, Compass, Moon, ShieldCheck, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const roles = [
  { id: 'guest', label: 'Guest View', icon: Compass },
  { id: 'resident', label: 'Resident Portal', icon: Building2 },
  { id: 'owner', label: 'Owner Admin', icon: ShieldCheck },
] as const;
export type Role = (typeof roles)[number]['id'];

export function SiteHeader({ role, onRoleChange, dark, onThemeChange }: {
  role: Role; onRoleChange: (role: Role) => void; dark: boolean; onThemeChange: () => void;
}) {
  return <header className="site-header">
    <div className="header-inner">
      <a className="brand" href="/" aria-label="The Regal Oasis home">
       <span className="brand-mark">
  <img
    src="/pg-logo.png"
    alt="The Regal Oasis logo"
    style={{ width: '36px', height: '36px', objectFit: 'contain' }}
  />
</span>
        <span className="brand-copy"><span className="brand-name">THE REGAL OASIS</span><span className="brand-status"><span className="status-dot" />By Sharath H</span></span>
      </a>
      <nav className="role-switcher" aria-label="Choose your view">
        {roles.map(({ id, label, icon: Icon }) => <Button key={id} variant="ghost" className="role-tab" aria-pressed={role === id} onClick={() => onRoleChange(id)}><Icon size={16} strokeWidth={1.7} /><span>{label}</span></Button>)}
      </nav>
      <div className="theme-control"><Button variant="ghost" size="icon" className="theme-toggle" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={onThemeChange}>{dark ? <Sun size={19} /> : <Moon size={19} />}</Button></div>
    </div>
  </header>;
}
