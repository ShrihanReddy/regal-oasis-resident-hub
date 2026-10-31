import { useState } from 'react';
import { Building2, Compass, ChevronDown, MessageCircle, Moon, Phone, ShieldCheck, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Add the owner's public phone number here (India: 91 followed by 10 digits).
// Example format only: '919876543210'. Leave empty until confirmed by owner.
const OWNER_PHONE = '+91 7411121120';
const phoneDigits = OWNER_PHONE.replace(/\D/g, '');
const validOwnerPhone = /^\d{10,15}$/.test(phoneDigits);

export const roles = [
  { id: 'guest', label: 'Guest View', icon: Compass },
  { id: 'resident', label: 'Resident Portal', icon: Building2 },
  { id: 'owner', label: 'Owner Admin', icon: ShieldCheck },
] as const;
export type Role = (typeof roles)[number]['id'];

export function SiteHeader({ role, onRoleChange, dark, onThemeChange }: {
  role: Role; onRoleChange: (role: Role) => void; dark: boolean; onThemeChange: () => void;
}) {
  const [contactOpen, setContactOpen] = useState(false);
  return <header className="site-header">
    <div className="header-inner">
      <div className="owner-contact">
        <Button type="button" variant="outline" className="owner-contact-trigger" aria-expanded={contactOpen} aria-controls="owner-contact-menu" onClick={() => setContactOpen(open => !open)}>
          Contact Owner <ChevronDown size={15} aria-hidden="true" />
        </Button>
        {contactOpen && <div id="owner-contact-menu" className="owner-contact-menu">
          {validOwnerPhone ? <>
            <a href={`tel:+${phoneDigits}`} onClick={() => setContactOpen(false)}><Phone size={16} />Call owner</a>
            <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noopener noreferrer" onClick={() => setContactOpen(false)}><MessageCircle size={16} />WhatsApp owner</a>
          </> : <p className="owner-contact-unavailable">Owner contact number to be added before launch.</p>}
        </div>}
      </div>
      <nav className="role-switcher" aria-label="Choose your view">
        {roles.map(({ id, label, icon: Icon }) => <Button key={id} variant="ghost" className="role-tab" aria-pressed={role === id} onClick={() => onRoleChange(id)}><Icon size={16} strokeWidth={1.7} /><span>{label}</span></Button>)}
      </nav>
      <div className="theme-control"><Button variant="ghost" size="icon" className="theme-toggle" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={onThemeChange}>{dark ? <Sun size={19} /> : <Moon size={19} />}</Button></div>
    </div>
  </header>;
}
