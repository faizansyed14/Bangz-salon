# BangzSalon - Setup Guide

## Prerequisites

1. A Supabase account (sign up at https://supabase.com)
2. A Netlify account (sign up at https://netlify.com)
3. Basic knowledge of HTML, CSS, and JavaScript

## Step 1: Set Up Supabase Database

1. Create a new project in Supabase
2. Go to the SQL Editor
3. Copy and paste the contents of `database-schema.sql` into the SQL Editor
4. Run the SQL script to create all tables and policies

## Step 2: Configure Supabase Client

1. In your Supabase project, go to Settings > API
2. Copy your:
   - Project URL (SUPABASE_URL)
   - Anon/Public Key (SUPABASE_ANON_KEY)
3. Open `js/supabase-client.js`
4. Replace the placeholder values:
   ```javascript
   const SUPABASE_URL = 'your_actual_supabase_url';
   const SUPABASE_ANON_KEY = 'your_actual_supabase_anon_key';
   ```

## Step 3: Set Up Authentication

### Option A: Simple Authentication (For Testing)

1. Create test users directly in the database:
   ```sql
   -- Create an admin user (password: admin123)
   INSERT INTO users (email, password_hash, role) 
   VALUES ('admin@gmail.com', 'admin000', 'admin');
   
   -- Create a worker
   INSERT INTO workers (name, phone) 
   VALUES ('John Doe', '+971501234567');
   
   -- Create a worker user
   INSERT INTO users (email, password_hash, role, worker_id) 
   VALUES ('worker@gmail.com', 'worker123', 'worker', 
           (SELECT id FROM workers WHERE name = 'John Doe'));
   ```

### Option B: Supabase Auth (Recommended for Production)

1. Enable Supabase Auth in your project
2. Update `js/auth.js` to use Supabase Auth methods
3. Update RLS policies to use `auth.uid()`

## Step 4: Test Locally

1. Serve the files using a local server:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js (http-server)
   npx http-server
   
   # Using PHP
   php -S localhost:8000
   ```
2. Open `http://localhost:8000` in your browser
3. Test login with your test credentials

## Step 5: Deploy to Netlify

1. Push your code to a Git repository (GitHub, GitLab, or Bitbucket)
2. Log in to Netlify
3. Click "New site from Git"
4. Connect your repository
5. Build settings:
   - Build command: (leave empty)
   - Publish directory: `.` (root)
6. Click "Deploy site"

## Step 6: Configure Environment Variables (Optional)

If you want to use environment variables instead of hardcoding:

1. In Netlify, go to Site settings > Environment variables
2. Add:
   - `SUPABASE_URL`: Your Supabase URL
   - `SUPABASE_ANON_KEY`: Your Supabase anon key
3. Update `js/supabase-client.js` to read from environment:
   ```javascript
   const SUPABASE_URL = window.SUPABASE_URL || 'your_default_url';
   const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'your_default_key';
   ```

## Step 7: Update RLS Policies for Production

The current RLS policies are permissive for testing. For production:

1. Implement proper authentication using Supabase Auth
2. Update policies to check `auth.uid()` and user roles
3. Example:
   ```sql
   CREATE POLICY "Workers can view own transactions"
   ON transactions FOR SELECT
   USING (
     auth.uid() IN (
       SELECT id FROM users WHERE worker_id = transactions.worker_id
     )
   );
   ```

## Troubleshooting

### CORS Errors
- Make sure your Supabase project allows requests from your domain
- Check Supabase Settings > API > CORS settings

### Authentication Not Working
- Verify your Supabase credentials are correct
- Check browser console for errors
- Ensure RLS policies are set correctly

### Timezone Issues
- All timestamps use 'Asia/Dubai' timezone
- Verify your Supabase database timezone settings
- Check that JavaScript date functions are working correctly

### Database Connection Errors
- Verify SupABASE_URL and SUPABASE_ANON_KEY are correct
- Check Supabase project status
- Ensure tables exist and have correct structure

## Security Notes

1. **Never commit** your Supabase keys to public repositories
2. Use environment variables for sensitive data
3. Implement proper password hashing (use Supabase Auth)
4. Enable HTTPS (Netlify provides this automatically)
5. Regularly update RLS policies based on your security requirements

## Next Steps

1. Add more workers and services
2. Create test transactions
3. Customize the design to match your brand
4. Add additional features as needed
5. Set up regular backups of your Supabase database

