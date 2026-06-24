import pg from 'pg';
const { Client } = pg;

async function check() {
  const client = new Client({
    connectionString: "postgres://postgres.neaarwiknzazunnbdlkv:h1wLzLDATixOT7YJ@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
  });
  
  try {
    await client.connect();
    const res = await client.query('SELECT email, is_active FROM users WHERE email = $1', ['admin@company.com']);
    console.log(res.rows);
  } catch (err) {
    console.error("Error connecting to db:", err.message);
  } finally {
    await client.end();
  }
}
check();
