
import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  residentChoices,
  sendProof,
} from '@/lib/resident-portal.functions';

const monthNow = new Date().toLocaleDateString('en-CA').slice(0, 7);

export function ResidentPortal() {
  const residents = useQuery({
    queryKey: ['resident-choices'],
    queryFn: () => residentChoices(),
  });

  const [resident, setResident] = useState('');
  const [billing, setBilling] = useState(monthNow);
  const [method, setMethod] = useState<
    'UPI' | 'Bank Transfer' | 'Cash'
  >('UPI');
  const [utr, setUtr] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setNotice('');

    try {
      await task();
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : 'Something went wrong.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function payment(e: FormEvent) {
    e.preventDefault();

    await run(async () => {
      if (!file) throw Error('Select a payment screenshot.');

      if (file.size > 5 * 1024 * 1024) {
        throw Error('Image must be under 5 MB.');
      }

      if (
        !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
      ) {
        throw Error('Use PNG, JPG or WebP.');
      }

      const contents = await new Promise<string>(
        (resolve, reject) => {
          const reader = new FileReader();

          reader.onload = () =>
            resolve(String(reader.result).split(',')[1] || '');

          reader.onerror = () =>
            reject(Error('Could not read image.'));

          reader.readAsDataURL(file);
        }
      );

      await sendProof({
        data: {
          allotment_id: resident,
          billing_month: billing,
          payment_method: method,
          utr,
          file: contents,
          mime: file.type as
            | 'image/png'
            | 'image/jpeg'
            | 'image/webp',
        },
      });

      setFile(null);
      setUtr('');
      setNotice(
        'Proof uploaded. Owner verification is pending.'
      );
    });
  }

  return (
    <section
      className="guest-section resident-portal"
      id="resident-services"
    >
      <div className="section-heading">
        <div>
          <p className="small-label">RESIDENT / SERVICES</p>
          <h2>Your resident portal</h2>
        </div>
        <p>Submit your rent payment proof for owner verification.</p>
      </div>

      <nav className="resident-tabs" aria-label="Resident services">
        <button
          type="button"
          disabled
          aria-label="Complaint board — Coming Soon"
          style={{
            opacity: 0.45,
            filter: 'grayscale(1)',
            cursor: 'not-allowed',
          }}
        >
          Complaint board · Coming Soon
        </button>

        <button type="button" aria-pressed="true">
          Rent proof
        </button>

        <button
          type="button"
          disabled
          aria-label="Anonymous feedback — Coming Soon"
          style={{
            opacity: 0.45,
            filter: 'grayscale(1)',
            cursor: 'not-allowed',
          }}
        >
          Anonymous feedback · Coming Soon
        </button>
      </nav>

      <label className="resident-field">
        Select your name
        <select
          required
          value={resident}
          onChange={e => setResident(e.target.value)}
        >
          <option value="">Choose an active resident</option>

          {(residents.data ?? []).map((r: any) => (
            <option value={r.id} key={r.id}>
              {r.student_name} · Room {r.room_number}
            </option>
          ))}
        </select>
      </label>

      <p className="resident-help">
        No resident PIN is required. Selecting a name does not
        verify identity; the owner will review submissions.
      </p>

      <form
        onSubmit={payment}
        className="resident-card resident-narrow"
      >
        <h3>Upload rent payment proof</h3>

        <p>
          Your screenshot will only be accessible to the owner;
          it will not appear on the public board.
        </p>

        <label className="resident-field">
          Rent month
          <input
            required
            type="month"
            value={billing}
            onChange={e => setBilling(e.target.value)}
          />
        </label>

        <label className="resident-field">
          Payment method
          <select
            value={method}
            onChange={e =>
              setMethod(e.target.value as typeof method)
            }
          >
            <option>UPI</option>
            <option>Bank Transfer</option>
            <option>Cash</option>
          </select>
        </label>

        <label className="resident-field">
          Transaction ID / UTR{' '}
          {method === 'Cash' ? '(optional)' : '(required)'}

          <input
            required={method !== 'Cash'}
            maxLength={150}
            value={utr}
            onChange={e => setUtr(e.target.value)}
          />
        </label>

        <label className="resident-field">
          Screenshot (PNG, JPG, or WebP, max 5 MB)
          <input
            required
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={e =>
              setFile(e.target.files?.[0] ?? null)
            }
          />
        </label>

        <button disabled={busy || !resident || !file}>
          {busy ? 'Uploading…' : 'Submit rent proof'}
        </button>

        <p className="resident-help">
          The owner can check current and past months in
          the existing Rental Ledger. Uploading is not proof
          of payment until reviewed.
        </p>
      </form>

      {notice && (
        <p className="resident-notice" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
