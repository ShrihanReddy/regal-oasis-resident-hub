# Feature 5 — Owner rental ledger

## Included
- Owner Admin: month/year filter; proof review, approve/reject; WhatsApp draft reminders; rent amounts and resident contact numbers.
- Download January–December ZIP archive: `rent-records.csv` plus every uploaded proof image. An incomplete image download aborts the archive; no online deletion occurs.
- Owner-only cleanup of a *completed* calendar year after a separate verification checkbox and typed confirmation. Clears proof images and rows, retains student records.
- Theme-aware resident-edit fields.

## Required before testing
1. Apply `drizzle/migrations/0007_rental_ledger.sql` **once** to the connected database. Check that columns do not already exist. Back up data first.
2. Push modified source files to your GitHub `development` branch; verify the hosted Preview still uses it.
3. Enter WhatsApp numbers in international digits-only format, e.g. 919876543210, and optional monthly rent amounts in Manage Residents.
4. Add proof records for testing with a billing month. Preexisting screenshots are backfilled using their submission month, which may differ from the month the rent was paid for.
5. Check that private proof review requires owner access; upload and edit permissions are enforced by the backend/RLS.

## Important known limitations / follow-up
- The resident proof upload UI still needs its own month picker and full resident-flow testing. The backend currently uses the submission month when the client doesn't specify a billing month.
- This ledger treats No Proof as *unknown*, not proof of nonpayment. Manual cash-paid verification without a receipt is not in this patch.
- If a resident submits multiple proofs in a month, the ledger currently displays the most recent; the annual ZIP includes all submitted proofs.
- Reminders open WhatsApp with a drafted message; they do not send automatically.
- Archive ZIP uses an uncompressed implementation; download cost and memory usage grow with image volume. Test archives for 12 months under expected scale before relying on it. Archive generation must not be treated as successful until verified on disk.
- Clear-year is irreversible and only allows years before the current calendar year. It can partially fail due to storage/network issues; recovery may require administrative reconciliation. Keep an offline archive and database export.
- A selected name in resident submissions is self-reported, not authenticated resident identity.
