# PowerPulse Database Setup

## Quick Start

**Run `database_setup.sql` in your Supabase SQL Editor** - that's it!

This single script will:
- ✅ Create all tables (`profiles`, `appliances`, `planning`)
- ✅ Set up all foreign key relationships
- ✅ Configure Row Level Security (RLS) policies
- ✅ Add necessary constraints (including unique user_id on planning)
- ✅ Clean up any duplicate data

## Tables Created

### 1. `profiles`
User profile information including budget targets and bill tracking.

### 2. `appliances`
User's electrical appliances with usage hours and power consumption.

### 3. `planning`
AI-generated energy optimization plans (one per user).

## Important Notes

- The script is **idempotent** - you can run it multiple times safely
- It will **not** delete existing data
- It **will** remove duplicate planning entries before adding the unique constraint
- All tables have proper RLS policies to ensure users can only access their own data

## Other SQL Files (For Reference Only)

The following files are kept for reference but **you don't need to run them**:
- `schema.sql` - Original schema (superseded by database_setup.sql)
- `planning_schema.sql` - Planning table only (merged into database_setup.sql)
- `fix_planning_duplicates.sql` - Duplicate cleanup (included in database_setup.sql)
- `add_planning_update_policy.sql` - Update policy (included in database_setup.sql)
- `verify_planning_constraint.sql` - Verification queries (optional)

**Just run `database_setup.sql` and you're done!**
