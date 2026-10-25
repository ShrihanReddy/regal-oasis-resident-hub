import { useEffect, useState, type ChangeEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import residence from '@/assets/residence.jpg';

const bucket = 'homepage-backgrounds';
const queryKey = ['homepage-background'];
type HeroSettings = { id: string; storage_path: string | null; position_x: number; position_y: number; heading_x: number; heading_y: number; heading_size: number; heading_color: string };
export const defaultHeading = { heading_x: 7, heading_y: 22, heading_size: 78, heading_color: '#FFFFFF' };
export type HeadingSettings = typeof defaultHeading;

async function loadHero(): Promise<HeroSettings> {
  const { data, error } = await supabase.from('homepage_settings').select('id,storage_path,position_x,position_y,heading_x,heading_y,heading_size,heading_color').eq('id', 'homepage').single();
  if (error) throw error;
  return data;
}
export function useHomepageBackground() {
  return useQuery({ queryKey, queryFn: loadHero, staleTime: 30_000, retry: 1 });
}
export function heroImageUrl(path: string | null | undefined) {
  return path ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl : residence;
}

async function optimizeHero(file: File): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG or WebP image.');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image processing is unavailable.');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.83));
    if (!blob) throw new Error('Unable to prepare the image.');
    if (blob.size > 6 * 1024 * 1024) throw new Error('Image is too large after optimization (6 MB limit).');
    return new File([blob], `${crypto.randomUUID()}.webp`, { type: 'image/webp' });
  } finally { bitmap.close(); }
}

export function HomepageCustomization() {
  const qc = useQueryClient();
  const { data, isPending, isError, refetch } = useHomepageBackground();
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [heading, setHeading] = useState<HeadingSettings>(defaultHeading);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [previous, setPrevious] = useState<HeroSettings | null>(null);
  useEffect(() => { if (data && !pendingFile) { setX(data.position_x); setY(data.position_y); setHeading({heading_x:data.heading_x,heading_y:data.heading_y,heading_size:data.heading_size,heading_color:data.heading_color}); } }, [data, pendingFile]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { setMessage('Please select a JPG, PNG or WebP image.'); return; }
    if (file.size > 25 * 1024 * 1024) { setMessage('Choose an image under 25 MB.'); return; }
    setPreviewUrl(URL.createObjectURL(file)); setPendingFile(file); setMessage('Preview ready. Adjust the position, then select Save changes.');
  }
  async function persist(path: string | null, newX: number, newY: number, newHeading: HeadingSettings) {
    const result = await supabase.from('homepage_settings').update({ storage_path: path, position_x: newX, position_y: newY, ...newHeading }).eq('id','homepage');
    if (result.error) throw result.error;
    await qc.invalidateQueries({ queryKey });
  }
  async function save() {
    if (!data) return;
    setBusy(true); setMessage('');
    let uploadedPath: string | null = null;
    try {
      if (pendingFile) {
        const file = await optimizeHero(pendingFile);
        uploadedPath = file.name;
        const upload = await supabase.storage.from(bucket).upload(uploadedPath, file, { upsert: false, contentType: 'image/webp' });
        if (upload.error) throw upload.error;
      }
      await persist(uploadedPath ?? data.storage_path, x, y, heading);
      setPrevious(data); setPendingFile(null); setPreviewUrl(null);
      setMessage('Homepage background updated successfully.');
    } catch (err) {
      if (uploadedPath) await supabase.storage.from(bucket).remove([uploadedPath]);
      setMessage(err instanceof Error ? err.message : 'Could not save the background.');
    } finally { setBusy(false); }
  }
  async function reset() {
    if (!data || !window.confirm('Restore the original homepage background?')) return;
    setBusy(true); setMessage('');
    try { await persist(null, 50, 50, defaultHeading); setPrevious(data); setPendingFile(null); setPreviewUrl(null); setX(50); setY(50); setHeading(defaultHeading); setMessage('Original background restored.'); }
    catch (err) { setMessage(err instanceof Error ? err.message : 'Could not reset background.'); }
    finally { setBusy(false); }
  }
  async function restorePrevious() {
    if (!previous) return;
    setBusy(true); setMessage('');
    try { await persist(previous.storage_path, previous.position_x, previous.position_y, {heading_x:previous.heading_x,heading_y:previous.heading_y,heading_size:previous.heading_size,heading_color:previous.heading_color}); setPendingFile(null); setPreviewUrl(null); setX(previous.position_x); setY(previous.position_y); setHeading({heading_x:previous.heading_x,heading_y:previous.heading_y,heading_size:previous.heading_size,heading_color:previous.heading_color}); setPrevious(null); setMessage('Previous background restored.'); }
    catch (err) { setMessage(err instanceof Error ? err.message : 'Could not restore previous background.'); }
    finally { setBusy(false); }
  }
  return <section className="homepage-editor guest-section" aria-label="Homepage customization">
    <div className="section-heading"><div><p className="small-label">HOMEPAGE / CREATIVE CONTROL</p><h2>Customize your homepage.</h2></div><p>Change the cover photo without editing code.</p></div>
    {isPending && <p>Loading homepage settings…</p>}
    {isError && <p role="alert">Homepage settings could not be loaded. <Button variant="outline" onClick={() => refetch()}>Retry</Button></p>}
    {data && <>
      <div className="homepage-editor-preview"><img src={previewUrl ?? heroImageUrl(data.storage_path)} style={{ objectPosition: `${x}% ${y}%` }} alt="Preview of the homepage background"/><div className="homepage-editor-shade"/><strong className="homepage-editor-title" style={{left:`${heading.heading_x}%`, top:`${heading.heading_y}%`, fontSize:`clamp(18px, ${heading.heading_size * 0.65}px, ${heading.heading_size}px)`, color:heading.heading_color}}>THE REGAL OASIS.</strong></div>
      <div className="homepage-editor-actions">
        <label className="gallery-upload-label"><ImagePlus size={18}/> Choose background <input type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} disabled={busy}/></label>
        <Button onClick={save} disabled={busy || (!pendingFile && x === data.position_x && y === data.position_y && heading.heading_x === data.heading_x && heading.heading_y === data.heading_y && heading.heading_size === data.heading_size && heading.heading_color === data.heading_color)}>{busy ? 'Saving…' : 'Save changes'}</Button>
        <Button variant="outline" onClick={reset} disabled={busy || (!data.storage_path && !pendingFile && x === 50 && y === 50 && heading.heading_x === defaultHeading.heading_x && heading.heading_y === defaultHeading.heading_y && heading.heading_size === defaultHeading.heading_size && heading.heading_color === defaultHeading.heading_color)}><RotateCcw size={16}/> Reset to default</Button>
        {previous && <Button variant="outline" onClick={restorePrevious} disabled={busy}>Restore previous</Button>}
      </div>
      <div className="homepage-position-controls"><label>Horizontal position: {x}% <input type="range" min="0" max="100" value={x} onChange={e => setX(Number(e.target.value))}/></label><label>Vertical position: {y}% <input type="range" min="0" max="100" value={y} onChange={e => setY(Number(e.target.value))}/></label></div>
      <div className="homepage-heading-controls" aria-label="Homepage title controls">
        <h3>Heading appearance</h3>
        <p className="homepage-editor-hint">Move “THE REGAL OASIS” within the cover preview. The title adapts to smaller screens.</p>
        <div className="homepage-position-controls">
          <label>Text horizontal position: {heading.heading_x}% <input type="range" min="2" max="65" value={heading.heading_x} onChange={e=>setHeading(h=>({...h,heading_x:Number(e.target.value)}))}/></label>
          <label>Text vertical position: {heading.heading_y}% <input type="range" min="5" max="75" value={heading.heading_y} onChange={e=>setHeading(h=>({...h,heading_y:Number(e.target.value)}))}/></label>
          <label>Text size: {heading.heading_size}px <input type="range" min="28" max="110" value={heading.heading_size} onChange={e=>setHeading(h=>({...h,heading_size:Number(e.target.value)}))}/></label>
          <label>Text colour <input type="color" aria-label="Heading colour" value={heading.heading_color} onChange={e=>setHeading(h=>({...h,heading_color:e.target.value}))}/></label>
        </div>
        <Button variant="outline" onClick={()=>setHeading(defaultHeading)} disabled={busy}>Reset heading controls</Button>
      </div>
      <p className="homepage-editor-hint">Images are resized for the web. The original homepage photo is always available using Reset. This changes the homepage cover only, not the property gallery.</p>
    </>}
    {message && <p role="status" className="form-message">{message}</p>}
  </section>;
}
