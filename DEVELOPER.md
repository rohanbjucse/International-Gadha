# International Gadha — Developer Guide

## What this app is

A real-time multiplayer card game. The browser draws the table and cards; a Node.js server owns the game state and decides whether a played card is safe or captures cards.

## The stack

- **Client:** JavaScript, React 19, and Vite. Vite builds the files the browser downloads.
- **Game server:** Node.js, Express, and Socket.IO. Express serves HTTP/health requests; Socket.IO sends live game events.
- **Game rules:** [`server/gameEngine.js`](./server/gameEngine.js) builds and deals cards, checks captures, scores Spades, and chooses bot moves.
- **Storage:** No database is connected. [`server/server.js`](./server/server.js) keeps rooms in a process-memory `Map`.
- **Tests:** `npm test` runs the game-engine and Socket.IO tests.

## How a game runs

1. `Home` creates or joins a room. The server returns a room code and private player/session IDs; the client remembers them in browser storage and the room code in the URL.
2. `App.jsx` sends plays and other commands over Socket.IO. The server validates each action, updates the room, and sends each player a view that hides other players’ hands.
3. `gameEngine.js` applies the rules. `Table.jsx` animates the result; clients acknowledge the animation so the server can advance the turn. Bots also play on the server.
4. Chat uses Socket.IO. Camera and microphone use WebRTC peer-to-peer media; Socket.IO only relays the connection setup. Each device needs its own permissions.

Main UI pieces: `Home` and `Lobby` (entry/waiting room), `Opponents` and `VideoTile` (players/media), `Table` (played cards), `PlayerHand` (your cards), `CaptureHistory`, and the chat/rules/game-over modals.

## Hosting in plain language

- **Vercel is your current host.** It is suitable for the website, but its separate server instances do not share this app’s in-memory room `Map`. A request can reach an instance that never saw the room, and a restart loses rooms.
- **Render is another hosting company, not a database.** The repo’s [`render.yaml`](./render.yaml) describes an alternate free Node server. Free services can sleep, and this app’s rooms would still disappear on restart. The default Render URL was unavailable at the last check.
- **Free rollout chosen:** keep the website on Vercel and deploy the Socket.IO server using the Render blueprint. The `international-gadha-free` Blueprint is now created from this repository on Render’s free plan. Its first build exposed a production-install issue: npm omitted Vite, a build-time dependency. The root build script now explicitly includes client dev dependencies; push this fix and sync/redeploy the Blueprint. Then set Vercel’s build variable `VITE_SERVER_URL` to the Render service’s public HTTPS URL and redeploy Vercel. The client supports this variable; it does not create or deploy the backend by itself.
- **Free-plan limit:** Render may sleep when idle, and this app has no database, so rooms can disappear after sleep, restart, or deploy. Players on different devices can join the same live room while the server is awake; keeping rooms through restarts needs shared persistent storage.

## What remains

1. Push the build fix, redeploy the Render Blueprint, then set `VITE_SERVER_URL` in Vercel and redeploy.
2. Replace the in-memory room store with shared durable storage if rooms must survive restarts and multiple instances.
3. Add a TURN relay for reliable video on restrictive mobile/carrier networks; the current WebRTC setup has STUN only.
4. Test the deployed game on desktop and mobile. Camera/mic preferences are per browser/device, not synced between devices.

Recent reliability, media, and board-layout changes in the working tree are not deployed yet. After the backend is chosen, run `npm test`, `npm --prefix client run build`, and deploy both the server and Vercel client.

## Run locally

- `npm start` runs the Node server on port 3001 and serves the built client.
- For live frontend editing, run `npm run dev:server` and `npm run dev:client` in separate terminals.
