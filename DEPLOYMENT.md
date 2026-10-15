# Deploy with the free Vercel and Render URLs

The web app can use its `*.vercel.app` URL and the Socket.IO server its `*.onrender.com` URL. The app obtains a one-minute socket ticket from its own authenticated API, then presents that ticket to Socket.IO. The regular login cookie stays on Vercel; it does not need to be shared with Render.

## 1. Put the project on GitHub

1. Create a GitHub repository and push this project to it.
2. Confirm `.env.local` is not committed. Keep production secrets out of GitHub.

## 2. Create a MongoDB database

1. Create a MongoDB Atlas account and a database/cluster.
2. Create a database user with a strong password.
3. Copy the application's MongoDB connection string and replace its username, password, and database name. URL-encode special characters in the username or password.
4. In Atlas **Network Access**, allow connections from the hosting services. For a free setup, `0.0.0.0/0` may be needed because Render's outbound IP can vary; this allows connections from any IP, so use a unique database password and a database user with only the permissions the app needs.

## 3. Deploy the web app on Vercel

1. In Vercel, choose **Add New → Project** and import the GitHub repository.
2. Keep the root directory at the project root. Let Vercel detect Next.js and use its default build settings (`npm run build`).
3. Under **Settings → Environment Variables**, add these for **Production**:

   | Name | Value |
   | --- | --- |
   | `MONGODB_URI` | Your production MongoDB connection string |
   | `JWT_SECRET` | A long, random secret; use the same value on Render |
   | `WEB_ORIGIN` | The exact Vercel production origin, e.g. `https://murmur.vercel.app` |
   | `SOCKET_SERVER_URL` | Temporary placeholder for now; replace with the Render URL in Step 4 |

4. Click **Deploy**. In the project overview, copy the production URL Vercel assigned (for example, `https://murmur.vercel.app`). Use the production domain, not a PR preview URL.

## 4. Deploy the Socket.IO server on Render

1. In Render, choose **New → Web Service** and connect the same GitHub repository.
2. Set the root directory to the project root, runtime to **Node**, build command to `npm ci`, and start command to `npx tsx server/index.ts`.
3. Add these environment variables to the Render service:

   | Name | Value |
   | --- | --- |
   | `MONGODB_URI` | Same production MongoDB connection string as Vercel |
   | `JWT_SECRET` | Exactly the same secret as Vercel |
   | `WEB_ORIGIN` | Exact Vercel production origin, e.g. `https://murmur.vercel.app` |

   Render provides `PORT` automatically. The server listens on it; do not add `SOCKET_PORT`.

4. Create the service and wait for it to finish deploying. Copy the Render service URL, such as `https://murmur-socket.onrender.com`.
5. The Render service's `/` path responds with `ok` for its health check.

## 5. Connect Vercel to Render

1. Go back to Vercel **Settings → Environment Variables**.
2. Set `SOCKET_SERVER_URL` to the full Render URL, including `https://` and with no trailing slash.
3. Redeploy Vercel so the updated variable is used.

## 6. Try it

1. Open the Vercel production URL and create/sign in to an account.
2. In browser developer tools, open **Network** and check that a connection to the Render URL succeeds. The app should show connected status.
3. Open the site in another browser/private window, sign in with another account, and send a message.
4. If it does not connect, compare `WEB_ORIGIN` character for character with the Vercel URL, confirm both services use the same `JWT_SECRET` and `MONGODB_URI`, and check the Render logs.

## PR preview deployments

Vercel PR previews use a different origin from the production `*.vercel.app` URL. This app and the Socket.IO server currently allow one exact `WEB_ORIGIN`, so use the production Vercel URL for the first deployment and verification. Supporting arbitrary PR preview URLs requires adding a carefully limited preview-origin allowlist.

## Local development

Keep `.env.local` local and uncommitted. Copy `.env.example` to `.env.local`, fill in development values, then run `npm run dev` and `npm run dev:socket` in separate terminals.
