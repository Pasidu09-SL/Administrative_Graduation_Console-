import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

async function main() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('.env.local file not found!');
    process.exit(1);
  }

  // Load the current connection string pointing to postgres
  const envContent = fs.readFileSync(envPath, 'utf8');
  let currentDbUrl = '';
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.startsWith('DATABASE_URL')) {
      const parts = trimmed.split('=');
      currentDbUrl = parts.slice(1).join('=').replace(/^['"]|['"]$/g, '').trim();
    }
  }

  if (!currentDbUrl) {
    console.error('DATABASE_URL not found in .env.local!');
    process.exit(1);
  }

  // Automatically correct user typo if they wrote postgres123@ instead of postgres:postgres123@
  if (currentDbUrl.includes('//postgres123@')) {
    currentDbUrl = currentDbUrl.replace('//postgres123@', '//postgres:postgres123@');
    console.log(`Normalized connection URL: ${currentDbUrl}`);
  }

  console.log(`Connecting to: ${currentDbUrl}`);

  // Step 1: Connect to the existing database (postgres) to clean up tables and create new database
  console.log('Connecting to postgres database to clean up old tables...');
  const postgresClient = new Client({ connectionString: currentDbUrl });
  await postgresClient.connect();

  try {
    // Drop existing tables on the "postgres" database
    console.log('Dropping tables in default database if they exist...');
    await postgresClient.query('DROP TABLE IF EXISTS audit_logs CASCADE');
    await postgresClient.query('DROP TABLE IF EXISTS otp_codes CASCADE');
    await postgresClient.query('DROP TABLE IF EXISTS students CASCADE');
    await postgresClient.query('DROP TABLE IF EXISTS registration_windows CASCADE');
    await postgresClient.query('DROP TABLE IF EXISTS degrees CASCADE');
    console.log('Old tables dropped successfully.');

    // Create the new database "reg_platform"
    console.log('Creating new database "reg_platform" if it doesn\'t exist...');
    const checkDbRes = await postgresClient.query("SELECT 1 FROM pg_database WHERE datname = 'reg_platform'");
    if (checkDbRes.rows.length === 0) {
      await postgresClient.query('CREATE DATABASE reg_platform');
      console.log('Database "reg_platform" created successfully.');
    } else {
      console.log('Database "reg_platform" already exists.');
    }
  } catch (err: any) {
    console.error('Error during cleanup or database creation:', err.message);
  } finally {
    await postgresClient.end();
  }

  // Step 2: Update .env.local file to point to "reg_platform"
  console.log('Updating .env.local file DATABASE_URL to target "reg_platform"...');
  
  let newDbUrl = currentDbUrl;
  const lastSlashIndex = currentDbUrl.lastIndexOf('/');
  if (lastSlashIndex !== -1) {
    newDbUrl = currentDbUrl.substring(0, lastSlashIndex) + '/reg_platform';
  } else {
    console.error('Could not parse database name from URL.');
    process.exit(1);
  }

  const newEnvContent = envContent.replace(
    /DATABASE_URL=.*/,
    `DATABASE_URL="${newDbUrl}"`
  );
  fs.writeFileSync(envPath, newEnvContent, 'utf8');
  console.log(`Updated .env.local successfully. New DATABASE_URL: ${newDbUrl}`);

  // Step 3: Run migrations on the new database
  console.log('Connecting to the newly created "reg_platform" database to run migrations...');
  const newClient = new Client({ connectionString: newDbUrl });
  await newClient.connect();

  try {
    const sqlPath = path.join(process.cwd(), 'src/db/migrations.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Executing migrations schema in "reg_platform"...');
    await newClient.query(sql);
    console.log('Migrations executed successfully on the new "reg_platform" database!');
  } catch (err: any) {
    console.error('Error executing migrations:', err.message);
    process.exit(1);
  } finally {
    await newClient.end();
  }

  console.log('Database migration successfully completed!');
}

main();
