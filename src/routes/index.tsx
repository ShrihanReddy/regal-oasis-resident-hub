import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUpRight, Crown } from 'lucide-react';
import { SiteHeader, type Role } from '@/components/site-header';
import residence from '@/assets/residence.jpg';

export const Route = createFileRoute('/')({
  head: () => ({ meta: [
    { title: 'THE REGAL OASIS | Student Living' },
    { name: 'description', content: 'Welcome to The Regal Oasis. A place for future residents, our student community, and property management.' },
    { property: 'og:title', content: 'THE REGAL OASIS | Student Living' },
    { property: 'og:description', content: 'Your space. Your community. Your oasis.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Index,
});

const viewContent = {
  guest: { eyebrow: 'A NEW CHAPTER STARTS HERE', heading: <>THE REGAL<br />OASIS<span className="heading-dot">.</span></>, description: 'Your space. Your community. Your oasis.', label: 'Welcome to your next chapter', subline: 'A place to settle in. A place to belong.' },
  resident: { eyebrow: 'YOUR EVERYDAY, A LITTLE BETTER', heading: <>WELCOME<br />HOME<span className="heading-dot">.</span></>, description: 'Your space. Your people. Your everyday.', label: 'Resident Portal', subline: 'Your own corner of The Regal Oasis.' },
  owner: { eyebrow: 'A THOUGHTFUL PLACE, THOUGHTFULLY MANAGED', heading: <>THE BIG<br />PICTURE<span className="heading-dot">.</span></>, description: 'A better place to live starts with you.', label: 'Owner Admin', subline: 'The Regal Oasis, from your point of view.' },
};

function Index() {
  const [role, setRole] = useState<Role>('guest');
  const [dark, setDark] = useState(true);
  useEffect(() => {
    try { setDark(localStorage.getItem('regal-theme') !== 'light'); } catch { /* Theme remains available without storage. */ }
  }, []);
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); }, [dark]);
  function toggleTheme() {
    const next = !dark;
    setDark(next);
    try { localStorage.setItem('regal-theme', next ? 'dark' : 'light'); } catch { /* Theme still updates for this visit. */ }
  }
  const content = viewContent[role];
  return <div className="site-shell">
    <SiteHeader role={role} onRoleChange={setRole} dark={dark} onThemeChange={toggleTheme} />
    <main>
      <section className="welcome-hero" aria-label={role === 'guest' ? 'Welcome to The Regal Oasis' : content.label}>
        <img className="hero-image" src={residence} alt="Illustrative vision of a leafy residence courtyard" width={1920} height={1024} />
        <div className="hero-shade" />
        <div className="hero-inner" key={role}>
          <div className="hero-eyebrow"><span className="eyebrow-line" />{content.eyebrow}</div>
          <h1>{content.heading}</h1>
          <p className="hero-description">{content.description}</p>
          <div className="hero-caption"><span className="caption-line" /><span>MORE THAN A STAY.<br /><strong>A SENSE OF BELONGING.</strong></span></div>
        </div>
        <div className="hero-bottom"><span><span className="mini-dot" /> STUDENT LIVING, REIMAGINED</span><span className="photo-note">A vision of your oasis</span><a href="#welcome" className="scroll-link" aria-label="Scroll to welcome"><ArrowDown size={18} /></a></div>
        <span className="hero-side-label">LIVE WELL. BELONG HERE.</span>
      </section>
      <section id="welcome" className="welcome-strip" aria-live="polite">
        <div className="welcome-strip-title"><span className="section-index">01 /</span><div><p className="small-label">THE REGAL WAY</p><h2>{content.label}</h2></div></div>
        <div className="welcome-strip-copy"><p>{content.subline}</p><ArrowUpRight size={24} strokeWidth={1.2} aria-hidden="true" /></div>
      </section>
    </main>
    <footer className="site-footer"><span><Crown size={14} /> THE REGAL OASIS</span><span>A little more than home.</span></footer>
  </div>;
}
