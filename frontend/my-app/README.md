# Thumbcraft — React + Vite frontend

This project uses a React/Vite frontend and a FastAPI backend.

## Stack
- React 19
- JavaScript (JSX)
- Vite 8
- Plain CSS (responsive layout; no extra UI library)

## Run locally

Configure `backend/.env` with your provider credentials before starting the API:

```text
OPENAI_API_KEY=your_openai_api_key
IMAGE_PRIVATE_KEY=your_imagekit_private_key
```

From the project root, use a PowerShell terminal to install and start the backend:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8080
```

In a second terminal, from the project root, start the frontend:

```powershell
cd frontend\my-app
npm install
npm run dev
```

The Vite development server proxies `/api` requests to `http://localhost:8080`. Keep both servers running. The OpenAI organization may need image-generation access enabled.

## Production build

```bash
npm run build
npm run preview
```

The production build is created in `dist/`. Set `VITE_API_BASE_URL` to your deployed API base URL when the frontend and backend are hosted on different origins, and configure the backend CORS allowlist for the frontend domain.

## Frontend files
- `src/App.jsx` — complete UI and generation workflow
- `src/App.css` — responsive dashboard styling
- `src/index.css` — global typography and reset
- `src/api.js` — browser-side API calls and event stream handling
- `src/main.jsx` — React entry point

## Notes
The UI uses the backend routes `/upload_headshot`, `/job`, `/job/{job_id}`, and `/jobs/{job_id}/stream`.
