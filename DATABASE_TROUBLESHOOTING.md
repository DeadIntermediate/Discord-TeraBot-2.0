# PostgreSQL Connection Troubleshooting Guide

This guide helps resolve common PostgreSQL connection issues with TeraBot.

## Common Connection Problems

### 1. DATABASE_URL Not Set
**Error**: `DATABASE_URL must be set. Did you forget to provision a database?`

**Solution**: 
```bash
# Create a .env file with your database URL
DATABASE_URL=postgresql://username:password@localhost:5432/terabot_db
```

### 2. Database Server Not Running
**Error**: `connection to server on socket failed`

**Solutions**:
- **Windows**: Start PostgreSQL service via Services app or:
  ```powershell
  net start postgresql-x64-14  # Adjust version number
  ```
- **Linux/Mac**: 
  ```bash
  sudo systemctl start postgresql  # Linux
  brew services start postgresql   # Mac with Homebrew
  ```

### 3. Authentication Failed
**Error**: `password authentication failed for user`

**Solutions**:
1. Verify credentials in DATABASE_URL
2. Reset PostgreSQL password:
   ```sql
   ALTER USER username PASSWORD 'newpassword';
   ```

### 4. Database Does Not Exist
**Error**: `database "terabot_db" does not exist`

**Solution**: Create the database:
```sql
CREATE DATABASE terabot_db;
```

### 5. Connection Timeout
**Error**: `timeout expired` or `connection timed out`

**Solutions**:
1. Check if PostgreSQL is accepting connections:
   ```bash
   psql -h localhost -p 5432 -U username -d postgres
   ```
2. Verify firewall settings allow port 5432
3. Check PostgreSQL configuration (`postgresql.conf`):
   ```
   listen_addresses = 'localhost'
   port = 5432
   ```

### 6. SSL Connection Issues
**Error**: `SSL connection has been closed unexpectedly`

**Solutions**:
1. Disable SSL for local development:
   ```
   DATABASE_URL=postgresql://username:password@localhost:5432/terabot_db?sslmode=disable
   ```
2. For production, ensure proper SSL certificates

## Testing Your Connection

### Manual Test
```bash
# Test basic connectivity
psql -h localhost -p 5432 -U username -d terabot_db

# Test from Node.js
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error(err);
  else console.log('Connected:', res.rows[0]);
  pool.end();
});
"
```

### Bot Built-in Test
The bot now includes comprehensive connection testing:
1. Environment variable validation
2. Database connectivity test
3. Detailed error reporting

## Environment Variables Reference

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | `postgresql://user:pass@localhost:5432/db` | Full database connection string |
| `DISCORD_BOT_TOKEN` | ✅ | `your_bot_token_here` | Discord bot authentication token |
| `NODE_ENV` | ❌ | `development` | Environment mode |
| `PORT` | ❌ | `5000` | Server port |

## Setup Checklist

- [ ] PostgreSQL server is installed and running
- [ ] Database exists and is accessible
- [ ] User has proper permissions on the database
- [ ] DATABASE_URL is correctly formatted
- [ ] DISCORD_BOT_TOKEN is valid
- [ ] Network connectivity allows database access
- [ ] No firewall blocking PostgreSQL port (5432)

## Quick Setup Commands

```bash
# 1. Install PostgreSQL (if not already installed)
# Windows: Download from postgresql.org
# Mac: brew install postgresql
# Linux: sudo apt install postgresql postgresql-contrib

# 2. Start PostgreSQL service
# Windows: net start postgresql-x64-14
# Mac: brew services start postgresql
# Linux: sudo systemctl start postgresql

# 3. Create database and user
sudo -u postgres psql
CREATE DATABASE terabot_db;
CREATE USER terabot_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE terabot_db TO terabot_user;
\q

# 4. Set environment variables
echo "DATABASE_URL=postgresql://terabot_user:your_password@localhost:5432/terabot_db" > .env
echo "DISCORD_BOT_TOKEN=your_bot_token_here" >> .env

# 5. Test the connection
npm run dev
```

## Getting Help

If you continue to experience issues:

1. Check the bot startup logs for specific error messages
2. Verify all environment variables are set correctly
3. Test database connectivity independently of the bot
4. Review PostgreSQL server logs for additional details
5. Ensure all dependencies are installed (`npm install`)

The bot now includes enhanced error reporting and will guide you through common issues automatically.