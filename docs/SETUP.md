# CapeConnect Setup Guide

## Prerequisites

- Node.js 20 or higher
- PostgreSQL 16 or higher
- npm or yarn
- Git

## Initial Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd capeconnect
```

### 2. Database Setup

Install PostgreSQL and create the database:

```bash
# Using psql
createdb capeconnect

# Or using SQL
psql -U postgres
CREATE DATABASE capeconnect;
\q
```

### 3. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your database credentials
# DATABASE_URL=postgres://username:password@localhost:5432/capeconnect

# Initialize database schema
npm run db:setup

# Start development server
npm run dev
```

The backend will run on `http://localhost:4000`

### 4. Frontend Setup

```bash
cd frontend-react

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Start development server
npm run dev
```

The frontend will run on `http://localhost:5173`

## Verification

### Test Backend

```bash
curl http://localhost:4000/health
```

### Run Backend Integration Tests

```bash
cd backend
npm test
```

Expected response:
```json
{"ok":true,"service":"capeconnect-backend","env":"development"}
```

### Test Login

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"william@capeconnect.demo","password":"Demo#123"}'
```

### Access Frontend

Open browser to `http://localhost:5173` and login with:
- Email: `william@capeconnect.demo`
- Password: `Demo#123`

## Docker Setup (Alternative)

```bash
cd backend

# Start PostgreSQL
docker-compose up -d

# Build API image
docker build -t capeconnect-api .

# Run API container
docker run -p 4000:4000 --env-file .env capeconnect-api
```

## Troubleshooting

### Database Connection Issues

- Verify PostgreSQL is running: `pg_isready`
- Check DATABASE_URL in `.env`
- Ensure database exists: `psql -l | grep capeconnect`

### Port Already in Use

- Backend: Change PORT in `backend/.env`
- Frontend: Vite will auto-increment port

### Missing Dependencies

```bash
# Backend
cd backend && npm install

# Frontend
cd frontend-react && npm install
```

## Next Steps

- Review [API Documentation](../backend/openapi.yml)
- Read [Backend README](../backend/README.md)
- Check [Data Source Contract](data-source-contract.md)
