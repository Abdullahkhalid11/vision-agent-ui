\# Vision Agent UI



React frontend for the Vision Agent. Upload a photo, see YOLOv8n detections drawn on it, and ask questions answered by a tool-calling LLM agent.



\*\*Live demo:\*\* https://vision-agent-ui-three.vercel.app

\*\*Backend (API, agent, eval):\*\* https://github.com/Abdullahkhalid11/vision-agent



> The backend runs on a personal PC behind a Cloudflare quick tunnel. When the PC is off or the tunnel is closed, the demo shows "Demo server offline".



\## How it works



The browser never talks to the backend directly. Three Vercel serverless functions in `api/` forward requests to the backend and attach the API key on the server side:



\- `api/health.js` forwards `GET /health`

\- `api/detect.js` forwards `POST /detect` (multipart image, up to 4 MB)

\- `api/ask.js` forwards `POST /ask` (question up to 500 characters)



Shared forwarding logic is in `lib/upstream.js`. The API key never reaches the browser.



\## Environment variables



Set these in the Vercel dashboard under Project Settings, then Environment Variables. Do not commit them.



| Name | Value |

|---|---|

| `UPSTREAM\_URL` | The backend's public URL, with no trailing slash |

| `UPSTREAM\_API\_KEY` | The backend's `API\_KEY` (not the Groq key) |



For local development, copy `.env.example` to `.env.local` and fill in the same two values. `.env.local` is git-ignored.



\## Local development



Requirements: Node.js 18 or later.



```powershell

npm install

npm run dev

```



The app runs at http://localhost:5173. The Vite dev server does not run the `api/` functions, so for local testing point `UPSTREAM\_URL` at a running backend and use `vercel dev`, or test against the deployed site.



\## Tests



```powershell

npm test

```



The tests cover the Vercel functions: method checks, input limits, the API key being attached server-side, the key never appearing in responses, upstream errors returned as 502 or 504, and multipart bodies forwarded unchanged. Expected result: 10 passing, 0 failing.



\## Build and deploy



```powershell

npm run build

```



Deployment is automatic from the `main` branch on Vercel. Import the repo once, set the two environment variables above, and deploy. The framework preset is Vite.



\## Project structure



api/ Vercel serverless functions (health, detect, ask)

lib/ shared upstream forwarding and error handling

src/ React app (App.jsx, BoxCanvas.jsx, api.js, App.css)

test/ function tests (node:test)

index.html Vite entry

vercel.json function timeout settings





\## Limits



\- Uploads are limited to 4 MB in the browser and at the proxy. The backend accepts up to 5 MB.

\- Questions are limited to 500 characters.

\- The backend allows 20 questions per minute per key. Rate-limited requests show a message asking the user to wait.

\- Availability depends on the backend PC and tunnel being online.

