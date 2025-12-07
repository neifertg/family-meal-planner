#!/usr/bin/env node

/**
 * Run a Supabase migration using direct SQL execution via Supabase REST API
 * Usage: node scripts/run-migration.js <migration-file-path>
 */

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function runMigration(migrationPath) {
  const absolutePath = path.resolve(migrationPath)

  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ Migration file not found: ${absolutePath}`)
    process.exit(1)
  }

  const sql = fs.readFileSync(absolutePath, 'utf8')
  const fileName = path.basename(absolutePath)

  console.log(`\n🚀 Running migration: ${fileName}`)
  console.log(`📄 File: ${absolutePath}`)
  console.log(`🔗 Database: ${SUPABASE_URL}\n`)

  try {
    // Execute raw SQL using Supabase client
    const { data, error } = await supabase.rpc('exec_sql', { sql })

    if (error) {
      console.error('❌ Migration failed:')
      console.error(error.message)
      if (error.details) console.error('Details:', error.details)
      if (error.hint) console.error('Hint:', error.hint)
      process.exit(1)
    }

    if (data) {
      console.log('📝 Result:', data)
    }

    console.log('✅ Migration completed successfully!\n')
  } catch (error) {
    console.error('❌ Error running migration:')
    console.error(error.message)
    process.exit(1)
  }
}

// Get migration file from command line argument
const migrationFile = process.argv[2]

if (!migrationFile) {
  console.error('Usage: node scripts/run-migration.js <migration-file-path>')
  console.error('Example: node scripts/run-migration.js supabase/migrations/20250107_fix_get_user_family_id.sql')
  process.exit(1)
}

runMigration(migrationFile)
