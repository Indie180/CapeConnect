# Migration Order

Apply migration files in this directory in ascending filename order.

Recommended production flow:
1. Back up the database
2. Apply each new `.sql` file in order
3. Start or restart the API
4. Verify `/health` and `/readyz`

For a brand new environment:
- run `sql/schema.sql`
- then run `sql/seed.sql` if seed data is required
- then apply any later migration files that were added after the schema snapshot
