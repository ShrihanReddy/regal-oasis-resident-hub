# Kitchen Inventory + Owner Navigation

1. On the `development` branch copy the listed changed files. Do not include `.env`.
2. Review `drizzle/migrations/0009_kitchen_inventory.sql`; verify that the five kitchen tables do not exist. Run the migration once in Lovable Cloud SQL Editor, after exporting/backing up the database. Do not rerun on error.
3. In Lovable Preview on `development`, sign in as an authorized owner, add test ingredients (use grams/millilitres/pieces), restock, create a recipe, set recipe components, prepare a test quantity, and verify exact deductions. Test undo and low stock. Remove test data before real use.
4. Dashboard section buttons scroll to the corresponding modules. Guest view should remain unchanged.
5. The pantry stores base quantities in grams, millilitres, and pieces. Input kg as grams (1 kg = 1000 g) and litres as millilitres (1 L = 1000 ml). Recipe yields may use kg, L or pieces.
6. Production and reversal use atomic PostgreSQL RPCs, protected by owner-role checks and row-level security. Do not mutate pantry stock directly using SQL during normal operations.
7. For production, both UI checks and database transactional checks enforce sufficient stock. Recipe edits affect future productions; historical quantity changes are preserved via stock events.

Not yet verified: full app dependency build, live database migration, owner end-to-end transactions.
