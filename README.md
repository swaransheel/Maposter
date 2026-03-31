# MAPOSTER

MAPOSTER is a full-stack city map poster app.

- Frontend: React + Vite + TypeScript
- Backend: Flask API
- Auth/Data: Supabase (anonymous auth supported)
- Output: high-quality generated map posters

## Features

- Search cities and generate styled map posters
- Multiple visual themes from JSON theme files
- User-scoped gallery and journal data
- Favorites, collections, and notes
- Account profile editing with avatar support
- Export and privacy controls

## Project Layout

- `frontend/`: web app (React + Vite)
- `backend/`: API server (Flask)
- `themes/`: theme JSON definitions
- `supabase/schema.sql`: database schema and policies
- `create_map_poster.py`: standalone poster generation script

## Prerequisites

- Python 3.11+
- Node.js 18+
- npm 9+
- Supabase project

## Environment Variables

Create local env files:

- `backend/.env`
- `frontend/.env.local`

Required backend variables (`backend/.env`):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Required frontend variables (`frontend/.env.local`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Optional frontend variable:

- `VITE_API_URL` (defaults to `http://localhost:5000/api`)

## Backend Setup

From project root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
python backend/api.py
```

Backend runs on http://localhost:5000

## Frontend Setup

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:5173

## Build Frontend

```powershell
cd frontend
npm run build
```

## Supabase Notes

- Apply schema from `supabase/schema.sql`
- Keep RLS enabled on user-owned tables
- Ensure frontend and backend point to the same Supabase project

## API Overview

- `GET /api/health`
- `GET /api/themes`
- `GET /api/posters`
- `POST /api/generate`
- `GET /api/cities/search?q=...`

