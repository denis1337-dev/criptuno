# Rules for AI Assistant

## Development

### Running the project
- Backend: `cd backend && npm run dev` (port 4002)
- Frontend: `cd frontend && npm run dev` (port 5173)
- Stop servers: `powershell -Command "Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force"`

### Building for production
- Push to `profile` branch for testing
- After successful test, merge to `master`
- Master branch auto-deploys to Vercel

## Deployment

- Frontend: https://criptuno.vercel.app (master branch)
- Backend: https://criptuno.onrender.com

## Git Workflow

1. Create feature branch: `git checkout -b <branch-name>`
2. Work in feature branch
3. Test locally
4. Push and create PR to master
5. Merge after review

## Code Style

- Use TypeScript
- Avoid adding comments unless requested
- Follow existing code conventions
