# Windows Setup Guide for CapeConnect

## Option 1: Install PostgreSQL (Recommended for Development)

### Download and Install PostgreSQL

1. Download PostgreSQL 16 from: https://www.postgresql.org/download/windows/
2. Run the installer
3. During installation:
   - Set password for postgres user (remember this!)
   - Port: 5432 (default)
   - Install pgAdmin 4 (GUI tool)
4. Add PostgreSQL to PATH:
   - Search "Environment Variables" in Windows
   - Edit System PATH
   - Add: `C:\Program Files\PostgreSQL\16\bin`
5. Restart your terminal

### Create Database

Open Command Prompt or PowerShell:

```powershell
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE capeconnect;

# Exit
\q
```

### Initialize Database

```powershell
cd backend

# Run schema
psql -U postgres -d capeconnect -f sql/schema.sql

# Run seed data
psql -U postgres -d capeconnect -f sql/seed.sql

# Run migrations
psql -U postgres -d capeconnect -f sql/migrations/2026-03-03_add_operator_to_audit_logs.sql
```

### Update .env

Edit `backend/.env`:
```
DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/capeconnect
```

### Start Backend

```powershell
cd backend
npm run dev
```

## Option 2: Docker Desktop (Alternative)

### Install Docker Desktop

1. Download from: https://www.docker.com/products/docker-desktop/
2. Install and restart computer
3. Start Docker Desktop

### Start PostgreSQL

```powershell
cd backend
docker-compose up -d
```

### Initialize Database

```powershell
# Wait 10 seconds for PostgreSQL to start
Start-Sleep -Seconds 10

# Run schema
docker exec -i backend-postgres-1 psql -U postgres -d capeconnect < sql/schema.sql

# Run seed
docker exec -i backend-postgres-1 psql -U postgres -d capeconnect < sql/seed.sql
```

### Start Backend

```powershell
npm run dev
```

## Option 3: Use SQLite (Quick Test - Not Recommended)

If you just want to test quickly without PostgreSQL, we can create a SQLite version.

## Verify Setup

### Test Backend

```powershell
curl http://localhost:4000/health
```

### Run Backend Tests

```powershell
cd backend
npm.cmd test
```

Notes:
- The backend test script now uses in-process Node test mode to avoid Windows `spawn EPERM` failures.
- Playwright uses `npm.cmd --prefix backend start` automatically on Windows.

### Test Login

```powershell
curl -X POST http://localhost:4000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{\"email\":\"william@capeconnect.demo\",\"password\":\"Demo#123\"}'
```

## Frontend Setup

```powershell
cd frontend-react
npm install
npm run dev
```

Open browser to: http://localhost:5173

## Troubleshooting

### "psql not recognized"
- PostgreSQL not installed or not in PATH
- Restart terminal after adding to PATH

### "Connection refused"
- PostgreSQL service not running
- Check Services (services.msc) for "postgresql-x64-16"

### "Database does not exist"
- Run: `createdb -U postgres capeconnect`

### Port 4000 already in use
- Change PORT in backend/.env
- Or kill process: `Get-Process -Id (Get-NetTCPConnection -LocalPort 4000).OwningProcess | Stop-Process`
