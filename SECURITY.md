# Security Guidelines

## 🔒 Sensitive Information Protection

### Environment Variables
All sensitive information is stored in `.env` file which is:
- ✅ Listed in `.gitignore` (never committed to git)
- ✅ Loaded via `dotenv` package
- ✅ Validated on startup via `envValidator.ts`

### Current Protected Secrets
- `DISCORD_BOT_TOKEN` - Discord bot authentication
- `DATABASE_URL` - PostgreSQL connection string
- `PGPASSWORD` - Database password
- `TWITCH_CLIENT_ID` - Twitch API credentials
- `TWITCH_CLIENT_SECRET` - Twitch API credentials
- `YOUTUBE_API_KEY` - YouTube API key
- `RAWG_API_KEY` - RAWG gaming API key
- `IGDB_CLIENT_ID` - IGDB gaming database credentials
- `IGDB_ACCESS_TOKEN` - IGDB access token
- `X_API_KEY` - Twitter/X API bearer token
- `INSTAGRAM_API_TOKEN` - Instagram API token

## 🛡️ Security Best Practices

### Before Deploying
1. **Never commit `.env` file to git**
   - Already in `.gitignore`
   - Check with: `git status` (should not show .env)

2. **Rotate tokens if exposed**
   - Discord Bot Token: https://discord.com/developers/applications
   - Database: Generate new password
   - API Keys: Regenerate from respective platforms

3. **Use environment-specific .env files**
   - `.env` - Local development
   - `.env.production` - Production server (never commit)
   - `.env.example` - Template with placeholders (safe to commit)

### Code Security
- ✅ No hardcoded secrets in TypeScript files
- ✅ All secrets loaded from `process.env`
- ✅ Environment validation on startup
- ✅ Error messages don't expose sensitive data

### Server Security
- Use HTTPS for production
- Enable rate limiting (already configured in `middleware/rateLimit.ts`)
- Keep dependencies updated: `npm audit` and `npm update`
- Use firewall rules to restrict database access
- Enable PostgreSQL SSL connections in production

### Database Security
- Use strong passwords (minimum 16 characters)
- Restrict database user permissions (principle of least privilege)
- Enable SSL connections (`DB_SSL=true` in .env)
- Regular backups (use `utils/backupManager.ts`)
- Never expose database port publicly

### Discord Bot Security
- Use minimal permissions (only what's needed)
- Validate all user inputs
- Use interaction deferral for long operations
- Implement proper error handling (already in `utils/errorTracking.ts`)

## 🚨 If Credentials Are Exposed

### Immediate Actions
1. **Discord Bot Token**
   - Regenerate at: https://discord.com/developers/applications
   - Update `.env` file
   - Restart bot

2. **Database Credentials**
   ```bash
   # Connect to database and change password
   ALTER USER botuser WITH PASSWORD 'new_secure_password';
   # Update DATABASE_URL in .env
   ```

3. **API Keys**
   - Revoke old keys from provider dashboards
   - Generate new keys
   - Update `.env` file

4. **If committed to GitHub**
   ```bash
   # Remove from git history (DANGEROUS - backup first!)
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .env" \
     --prune-empty --tag-name-filter cat -- --all
   
   # Force push (only if you own the repo)
   git push origin --force --all
   ```

## ✅ Security Checklist

Before pushing code:
- [ ] `.env` is in `.gitignore`
- [ ] No hardcoded secrets in code
- [ ] `.env.example` has placeholder values only
- [ ] All API keys are valid and active
- [ ] Database credentials are strong
- [ ] Error logs don't expose sensitive data
- [ ] `npm audit` shows no critical vulnerabilities

Before deploying:
- [ ] Server firewall configured
- [ ] HTTPS enabled
- [ ] Database SSL enabled
- [ ] Rate limiting tested
- [ ] Backup strategy in place
- [ ] Monitoring/logging configured
- [ ] Different credentials for dev/production

## 📝 Notes
- The bot uses Discord.js v14 with proper token handling
- PostgreSQL connection pooling configured in `db-manager.ts`
- All API integrations use secure HTTPS endpoints
- Error tracking sanitizes sensitive data before logging
