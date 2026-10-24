import { useState, type ChangeEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ImagePlus, Pencil, Trash2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Tables } from '@/integrations/supabase/types';

type Photo = Tables<'property_gallery'>;
const bucket = 'property-gallery';
const galleryKey = ['public-gallery'];

async function readGallery(): Promise<Photo[]> {
  const { data, error } = await supabase.from('property_gallery').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true });
  if (error) throw new Error('The photo gallery could not be loaded.');
  return data ?? [];
}
function imageUrl(path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose image files.');
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Use JPEG, PNG, or WebP photos.');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare this image.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.82));
    if (!blob) throw new Error('Could not compress this image.');
    if (blob.size > 6 * 1024 * 1024) throw new Error('Photo exceeds the 6 MB upload limit.');
    return new File([blob], `${crypto.randomUUID()}.webp`, { type: 'image/webp' });
  } finally { bitmap.close(); }
}

export function PropertyGallery({ editable = false }: { editable?: boolean }) {
  const qc = useQueryClient();
  const { data: photos = [], isLoading, isError, refetch } = useQuery({ queryKey: galleryKey, queryFn: readGallery, staleTime: 30000 });
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])]; event.target.value = '';
    if (!files.length) return;
    setBusy(true); setMessage(''); let uploaded = 0;
    try {
      if (files.length > 20) throw new Error('Upload up to 20 photos at a time.');
      let order = Math.max(0, ...photos.map(photo => photo.sort_order)) + 1;
      for (const original of files) {
        const file = await compressImage(original);
        const path = file.name;
        const result = await supabase.storage.from(bucket).upload(path, file, { contentType: 'image/webp', upsert: false });
        if (result.error) throw result.error;
        const inserted = await supabase.from('property_gallery').insert({ storage_path: path, sort_order: order++ });
        if (inserted.error) { await supabase.storage.from(bucket).remove([path]); throw inserted.error; }
        uploaded++;
      }
      setMessage(`${uploaded} photo${uploaded === 1 ? '' : 's'} uploaded successfully.`);
    } catch (error) { setMessage(`${uploaded} uploaded. ${error instanceof Error ? error.message : 'Could not upload all photos.'}`); }
    finally { await qc.invalidateQueries({ queryKey: galleryKey }); setBusy(false); }
  }
  async function remove(photo: Photo) {
    if (!window.confirm('Delete this photo from the public gallery?')) return;
    setBusy(true); setMessage('');
    try {
      const deleted = await supabase.storage.from(bucket).remove([photo.storage_path]);
      if (deleted.error) throw deleted.error;
      const record = await supabase.from('property_gallery').delete().eq('id', photo.id);
      if (record.error) throw record.error;
      setMessage('Photo deleted.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not delete photo.'); }
    finally { await qc.invalidateQueries({ queryKey: galleryKey }); setBusy(false); }
  }
  async function saveCaption(photo: Photo) {
    setBusy(true); setMessage('');
    try {
      const result = await supabase.from('property_gallery').update({ caption: caption.trim() }).eq('id', photo.id);
      if (result.error) throw result.error;
      setEditing(null); setMessage('Caption saved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save caption.'); }
    finally { await qc.invalidateQueries({ queryKey: galleryKey }); setBusy(false); }
  }
  async function move(index: number, direction: -1 | 1) {
    const other = index + direction;
    if (other < 0 || other >= photos.length) return;
    setBusy(true); setMessage('');
    try {
      const a = photos[index]!, b = photos[other]!;
      const first = await supabase.from('property_gallery').update({ sort_order: b.sort_order }).eq('id', a.id);
      if (first.error) throw first.error;
      const second = await supabase.from('property_gallery').update({ sort_order: a.sort_order }).eq('id', b.id);
      if (second.error) throw second.error;
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not reorder photo.'); }
    finally { await qc.invalidateQueries({ queryKey: galleryKey }); setBusy(false); }
  }
  const current = selected === null ? null : photos[selected];
  return <section id="explore-gallery" className="guest-section property-gallery-section">
    <div className="section-heading"><div><p className="small-label">03 / EXPLORE YOUR OASIS</p><h2>{editable ? 'Manage the photo gallery' : 'A glimpse of life at Regal Oasis.'}</h2></div><p>{editable ? 'Upload anytime. Your gallery updates automatically.' : 'Discover the spaces that make this place home.'}</p></div>
    {editable && <div className="gallery-upload"><label className="gallery-upload-label"><ImagePlus size={20} /> {busy ? 'Working…' : 'Add photos'}<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={upload} /></label><span>Upload up to 20 images at once. JPG, PNG or WebP. Optimized automatically.</span></div>}
    {message && <p className="form-message" role="status">{message}</p>}
    {isLoading && <p className="gallery-empty">Loading property photos…</p>}
    {isError && <div className="gallery-empty" role="alert">Could not load photos. <Button variant="outline" onClick={() => refetch()}>Try again</Button></div>}
    {!isLoading && !isError && photos.length === 0 && <div className="gallery-empty">{editable ? 'No photos yet. Add the first property photo above.' : 'Property photographs are coming soon.'}</div>}
    {photos.length > 0 && <div className="property-gallery-grid">{photos.map((photo, index) => <article className="property-photo" key={photo.id}>
      <button className="property-photo-open" type="button" aria-label={`View property photo ${index + 1}`} onClick={() => setSelected(index)}><img loading="lazy" src={imageUrl(photo.storage_path)} alt={photo.caption || `Regal Oasis property photo ${index + 1}`} /></button>
      {photo.caption && <p className="property-photo-caption">{photo.caption}</p>}
      {editable && <div className="gallery-actions"><Button variant="outline" size="sm" disabled={busy || index === 0} onClick={() => move(index, -1)} aria-label="Move photo earlier">←</Button><Button variant="outline" size="sm" disabled={busy || index === photos.length - 1} onClick={() => move(index, 1)} aria-label="Move photo later">→</Button><Button variant="outline" size="sm" disabled={busy} onClick={() => {setEditing(photo.id);setCaption(photo.caption);}}><Pencil size={13}/> Caption</Button><Button variant="outline" size="sm" disabled={busy} onClick={() => remove(photo)}><Trash2 size={13}/> Delete</Button></div>}
      {editable && editing === photo.id && <form className="gallery-caption-form" onSubmit={e => {e.preventDefault(); void saveCaption(photo);}}><Input aria-label="Photo caption" maxLength={180} value={caption} onChange={e => setCaption(e.target.value)} /><Button disabled={busy} type="submit" size="sm">Save</Button><Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></form>}
    </article>)}</div>}
    {current && <div className="gallery-lightbox" role="dialog" aria-modal="true" aria-label="Property photograph viewer" onClick={() => setSelected(null)}><div className="gallery-lightbox-inner" onClick={e => e.stopPropagation()}><button type="button" className="gallery-close" aria-label="Close photo viewer" onClick={() => setSelected(null)}><X/></button><img src={imageUrl(current.storage_path)} alt={current.caption || `Regal Oasis property photo ${selected! + 1}`} />{current.caption && <p>{current.caption}</p>}<div className="gallery-lightbox-nav"><Button aria-label="Previous photo" variant="outline" onClick={() => setSelected(index => index === null ? null : (index + photos.length - 1) % photos.length)}><ChevronLeft/></Button><span>{selected! + 1} / {photos.length}</span><Button aria-label="Next photo" variant="outline" onClick={() => setSelected(index => index === null ? null : (index + 1) % photos.length)}><ChevronRight/></Button></div></div></div>}
  </section>;
}
