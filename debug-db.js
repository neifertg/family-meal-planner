const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Shane6132024_@db.topkyhwzcvclhwwxsolq.supabase.co:5432/postgres';

async function diagnose() {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    // 1. Check if function exists
    console.log('=== 1. Checking if create_umbrella_group function exists ===');
    const funcResult = await client.query(`
      SELECT routine_name, routine_type
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_name = 'create_umbrella_group'
    `);
    console.log(funcResult.rows);
    console.log('');

    // 2. Check RLS status
    console.log('=== 2. Checking RLS status ===');
    const rlsResult = await client.query(`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename IN ('umbrella_groups', 'umbrella_group_memberships', 'users')
    `);
    console.log(rlsResult.rows);
    console.log('');

    // 3. Check policies
    console.log('=== 3. Checking RLS policies ===');
    const policiesResult = await client.query(`
      SELECT tablename, policyname, cmd
      FROM pg_policies
      WHERE tablename IN ('umbrella_groups', 'umbrella_group_memberships', 'users')
      ORDER BY tablename, policyname
    `);
    console.log(policiesResult.rows);
    console.log('');

    // 4. Check triggers
    console.log('=== 4. Checking triggers on umbrella_groups ===');
    const triggersResult = await client.query(`
      SELECT trigger_name, event_manipulation, action_timing, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'umbrella_groups'
    `);
    console.log(triggersResult.rows);
    console.log('');

    // 5. Check users table
    console.log('=== 5. Checking users table count ===');
    const usersResult = await client.query(`
      SELECT COUNT(*) as user_count FROM users
    `);
    console.log(usersResult.rows);
    console.log('');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

diagnose();
