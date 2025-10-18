#!/usr/bin/env pwsh
<#
.SYNOPSIS
    TeraBot 2.0 Automated Setup Script for Windows
.DESCRIPTION
    This script automatically installs all dependencies, sets up the database,
    and configures TeraBot 2.0 Discord bot for Windows systems.
.NOTES
    Author: Josh (DeadIntermediate)
    Version: 2.1.0
    Requires: PowerShell 5.1+ or PowerShell Core 7+
#>

param(
    [switch]$SkipDependencies,
    [switch]$RepairMode,
    [switch]$CloudDatabase,
    [string]$DatabaseUrl = ""
)

# Colors for output
$Red = "`e[31m"
$Green = "`e[32m"
$Yellow = "`e[33m"
$Blue = "`e[34m"
$Reset = "`e[0m"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = $Reset)
    Write-Host "$Color$Message$Reset"
}

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-Command {
    param([string]$Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

function Install-NodeJS {
    Write-ColorOutput "🔧 Installing Node.js..." $Blue
    
    if (Test-Command "winget") {
        try {
            winget install -e --id OpenJS.NodeJS --accept-package-agreements --accept-source-agreements
            # Refresh environment variables
            $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
            Write-ColorOutput "✅ Node.js installed successfully!" $Green
        }
        catch {
            Write-ColorOutput "❌ Failed to install Node.js via winget: $_" $Red
            Write-ColorOutput "Please install Node.js manually from https://nodejs.org" $Yellow
            return $false
        }
    }
    else {
        Write-ColorOutput "❌ winget not available. Please install Node.js manually from https://nodejs.org" $Red
        return $false
    }
    return $true
}

function Install-PostgreSQL {
    Write-ColorOutput "🗄️ Installing PostgreSQL..." $Blue
    
    if (Test-Command "winget") {
        try {
            winget install -e --id PostgreSQL.PostgreSQL.17 --accept-package-agreements --accept-source-agreements
            # Refresh environment variables
            $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
            $env:PATH += ";C:\Program Files\PostgreSQL\17\bin"
            
            Write-ColorOutput "✅ PostgreSQL installed successfully!" $Green
            Write-ColorOutput "⚠️ Please remember the password you set during installation!" $Yellow
        }
        catch {
            Write-ColorOutput "❌ Failed to install PostgreSQL via winget: $_" $Red
            return $false
        }
    }
    else {
        Write-ColorOutput "❌ winget not available. Please install PostgreSQL manually" $Red
        return $false
    }
    return $true
}

function Setup-Database {
    Write-ColorOutput "🗄️ Setting up database..." $Blue
    
    if ($CloudDatabase -or $DatabaseUrl) {
        Write-ColorOutput "☁️ Using cloud database configuration..." $Blue
        return $true
    }
    
    # Test PostgreSQL connection
    if (Test-Command "psql") {
        Write-ColorOutput "✅ PostgreSQL client found!" $Green
        
        # Check if service is running
        $service = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
        if ($service -and $service.Status -eq "Running") {
            Write-ColorOutput "✅ PostgreSQL service is running!" $Green
            return $true
        }
        else {
            Write-ColorOutput "⚠️ PostgreSQL service not running. Attempting to start..." $Yellow
            try {
                Start-Service -Name "postgresql*"
                Write-ColorOutput "✅ PostgreSQL service started!" $Green
                return $true
            }
            catch {
                Write-ColorOutput "❌ Failed to start PostgreSQL service: $_" $Red
                return $false
            }
        }
    }
    else {
        Write-ColorOutput "❌ PostgreSQL not found. Installing..." $Yellow
        return Install-PostgreSQL
    }
}

function Setup-Environment {
    Write-ColorOutput "🔧 Setting up environment configuration..." $Blue
    
    if (-not (Test-Path ".env")) {
        if (Test-Path ".env.example") {
            Copy-Item ".env.example" ".env"
            Write-ColorOutput "✅ Created .env file from .env.example" $Green
        }
        else {
            Write-ColorOutput "⚠️ Creating basic .env file..." $Yellow
            $envContent = @"
# Discord Bot Configuration
DISCORD_BOT_TOKEN=your_discord_bot_token_here

# Database Configuration
DATABASE_URL=postgresql://postgresql:password@localhost:5432/discord_bot

# Individual PostgreSQL credentials
PGHOST=localhost
PGPORT=5432
PGUSER=postgresql
PGPASSWORD=password
PGDATABASE=discord_bot

# Environment
NODE_ENV=development
"@
            Set-Content -Path ".env" -Value $envContent
            Write-ColorOutput "✅ Created basic .env file" $Green
        }
        
        Write-ColorOutput "⚠️ Please edit .env file with your Discord bot token and database credentials!" $Yellow
        Write-ColorOutput "📖 Instructions: https://discord.com/developers/applications" $Blue
    }
    else {
        Write-ColorOutput "✅ .env file already exists" $Green
    }
}

function Install-Dependencies {
    Write-ColorOutput "📦 Installing Node.js dependencies..." $Blue
    
    if (-not (Test-Path "package.json")) {
        Write-ColorOutput "❌ package.json not found! Are you in the correct directory?" $Red
        return $false
    }
    
    try {
        npm install
        Write-ColorOutput "✅ Node.js dependencies installed successfully!" $Green
        return $true
    }
    catch {
        Write-ColorOutput "❌ Failed to install dependencies: $_" $Red
        return $false
    }
}

function Run-DatabaseMigration {
    Write-ColorOutput "🗄️ Running database migration..." $Blue
    
    try {
        npm run db:push
        Write-ColorOutput "✅ Database migration completed successfully!" $Green
        return $true
    }
    catch {
        Write-ColorOutput "❌ Database migration failed: $_" $Red
        Write-ColorOutput "💡 This might be due to database connection issues." $Yellow
        Write-ColorOutput "💡 Check your .env file and ensure PostgreSQL is running." $Yellow
        return $false
    }
}

function Test-BotSetup {
    Write-ColorOutput "🧪 Testing bot setup..." $Blue
    
    # Check critical files
    $requiredFiles = @("package.json", ".env", "server/index.ts", "shared/schema.ts")
    $missingFiles = @()
    
    foreach ($file in $requiredFiles) {
        if (-not (Test-Path $file)) {
            $missingFiles += $file
        }
    }
    
    if ($missingFiles.Count -gt 0) {
        Write-ColorOutput "❌ Missing required files:" $Red
        foreach ($file in $missingFiles) {
            Write-ColorOutput "   - $file" $Red
        }
        return $false
    }
    
    Write-ColorOutput "✅ All required files present!" $Green
    return $true
}

function Repair-Installation {
    Write-ColorOutput "🔧 Repair mode activated..." $Yellow
    
    # Fix node_modules
    if (Test-Path "node_modules") {
        Write-ColorOutput "🗑️ Removing node_modules..." $Blue
        Remove-Item -Recurse -Force "node_modules"
    }
    
    if (Test-Path "package-lock.json") {
        Write-ColorOutput "🗑️ Removing package-lock.json..." $Blue
        Remove-Item -Force "package-lock.json"
    }
    
    # Clear npm cache
    Write-ColorOutput "🧹 Clearing npm cache..." $Blue
    npm cache clean --force
    
    # Reinstall dependencies
    Install-Dependencies
}

function Show-PostInstallInstructions {
    Write-ColorOutput "`n🎉 TeraBot 2.0 Setup Complete!" $Green
    Write-ColorOutput "===========================================" $Green
    Write-ColorOutput ""
    Write-ColorOutput "📝 Next Steps:" $Blue
    Write-ColorOutput "1. Edit .env file with your Discord bot token" $Yellow
    Write-ColorOutput "2. Configure your database settings in .env" $Yellow
    Write-ColorOutput "3. Run: npm run dev (to start in development mode)" $Yellow
    Write-ColorOutput "4. Or run: npm start (to start in production mode)" $Yellow
    Write-ColorOutput ""
    # Feature-specific docs removed
    Write-ColorOutput ""
    Write-ColorOutput "📚 Documentation:" $Blue
    Write-ColorOutput "- README.md - General bot information" $Yellow
    Write-ColorOutput "- DEPLOYMENT.md - Deployment instructions" $Yellow
    # CAH doc removed (was deleted)
    Write-ColorOutput ""
    Write-ColorOutput "❓ Need help? Check the troubleshooting section in README.md" $Blue
}

# Main execution
Write-ColorOutput "🤖 TeraBot 2.0 Setup Script" $Blue
Write-ColorOutput "============================" $Blue
Write-ColorOutput ""

# Check if running in correct directory
if (-not (Test-Path "package.json")) {
    Write-ColorOutput "❌ Error: package.json not found!" $Red
    Write-ColorOutput "Please run this script from the TeraBot 2.0 root directory." $Yellow
    exit 1
}

# Repair mode
if ($RepairMode) {
    Repair-Installation
    exit 0
}

# Check dependencies
if (-not $SkipDependencies) {
    Write-ColorOutput "🔍 Checking system dependencies..." $Blue
    
    # Check Node.js
    if (-not (Test-Command "node")) {
        Write-ColorOutput "❌ Node.js not found. Installing..." $Yellow
        if (-not (Install-NodeJS)) {
            exit 1
        }
    }
    else {
        $nodeVersion = node --version
        Write-ColorOutput "✅ Node.js found: $nodeVersion" $Green
    }
    
    # Check npm
    if (-not (Test-Command "npm")) {
        Write-ColorOutput "❌ npm not found. This should be installed with Node.js!" $Red
        exit 1
    }
    else {
        $npmVersion = npm --version
        Write-ColorOutput "✅ npm found: $npmVersion" $Green
    }
}

# Setup database
if (-not $CloudDatabase) {
    Setup-Database
}

# Setup environment
Setup-Environment

# Install Node.js dependencies
if (-not (Install-Dependencies)) {
    Write-ColorOutput "❌ Failed to install dependencies. Try running with -RepairMode" $Red
    exit 1
}

# Test setup
if (-not (Test-BotSetup)) {
    Write-ColorOutput "❌ Setup verification failed!" $Red
    exit 1
}

# Run database migration
if (-not $SkipDependencies) {
    Run-DatabaseMigration
}

# Show completion message
Show-PostInstallInstructions

Write-ColorOutput "✅ Setup completed successfully!" $Green