# Telegram Mini App Learning Platform

Monorepo with:
- `frontend`: Telegram Mini App client (React + TypeScript + Vite)
- `backend`: API server (Fastify + TypeScript + PostgreSQL)

## Features
- Course links on the main screen.
- Static bottom navigation: Courses, Games, Profile.
- Games section with score submission.
- Profile section with Telegram user info, progress, and dynamic avatar stage.
- Avatar stage recalculated by backend rules engine.

## Quick Start
1. Install Node.js 20+ and npm.
2. Start PostgreSQL:
   - `docker compose up -d`
3. Configure env files:
   - Copy `backend/.env.example` to `backend/.env`.
4. Install dependencies:
   - `cd backend && npm install`
   - `cd ../frontend && npm install`
5. Run backend and frontend:
   - `cd backend && npm run dev`
   - `cd ../frontend && npm run dev`

## Telegram Notes
- Backend validates Telegram `initData` signature.
- Frontend uses Telegram WebApp context when available and falls back to local mock mode for development.
