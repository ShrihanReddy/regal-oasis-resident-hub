# Resident directory — Feature 4 (initial milestone)

This adds the Owner Admin resident directory. The owner can add, edit, deactivate and reactivate residents. No PIN is introduced. The historical resident ID is retained when deactivated so rent records remain linked.

## Deploy
1. Copy this package's files into your development branch; inspect diffs.
2. Apply `drizzle/migrations/0006_resident_directory.sql` ONCE in the Lovable SQL Editor after backing up. It adds `sharing_type` and `has_ac` to the existing `student_allotments` table.
3. Push development and test owner add/edit/deactivate/reactivate in Lovable preview with an authorized owner account.
4. Do not publish until permissions and errors are tested.

## Privacy and planned work
The resident directory is **owner-only**. Future resident-facing name dropdowns must expose minimal data and not reveal sensitive student details. Without individual resident authentication, choosing a name is self-reported and must not be treated as verified identity. The existing resident security-code check may still be present in the earlier portal backend; this milestone does NOT remove it yet. Payment proofs and complaint flows are separate future milestones.
