# 🫏 International Gadha - Web Card Game

> **"International Gadha"** is a card-eating multiplayer game inspired by traditional South Asian card-fishing games and modern online card rooms. Watch out for the **Spades (♠)** or be crowned the ultimate **International Gadha**!

---

## 🎮 Game Rules & Mechanics

### 1. Players & Deck Division
- **3 to 6 players** play the game.
- The standard deck is divided equally among players:
  - **3 Players:** 52 cards + **2 Jokers** = 54 cards (**18 cards each**)
  - **4 Players:** 52 cards = (**13 cards each**, 0 jokers)
  - **5 Players:** 52 cards + **3 Jokers** = 55 cards (**11 cards each**)
  - **6 Players:** 54 cards with **2 Jokers** (**9 cards each**)

### 2. The Gadha (♠) Numbers
- **All SPADE (♠) cards are Gadha cards!**
- The Gadha value is equal to the card's face value:
  - **Ace (♠A):** 1 point
  - **2..10 (♠2..♠10):** 2 to 10 points
  - **Jack (♠J):** 11 points
  - **Queen (♠Q):** 12 points
  - **King (♠K):** 13 points
- **Hearts (♥), Diamonds (♦), Clubs (♣), and Jokers (🃏)** count as **0 Gadha points**.
- Motive: **Accumulate as FEW Gadha points as possible** in your bank!

### 3. Turn Flow: Unique vs. Eaten
At each turn, a player plays 1 card face-up onto the center table:

1. **SAFE (Unique Move):**
   - If **NO card** on the table has the same rank, **AND**
   - **NO sum of any two cards** on the table equals the thrown card's rank:
   - 👉 The card is **SAFE** and stays on the table. Turn passes to the next player.

2. **EATEN (Capture!):**
   - If the played card matches any card on the table, **OR**
   - Equals the sum of any two cards on the table:
   - 👉 The player **eats** (picks up) all the matched table cards **plus** their thrown card!
   - All eaten cards go into that player's **Bank**.

#### Real Example (from game rules):
1. Table starts with: `[♥A (1), ♣2, ♠9]`
2. **Player A** plays `♥4`:
   - `1+2=3`, `1+9=10`, `2+9=11` (none equal 4).
   - `♥4` is **SAFE** and stays on the table.
   - Table now: `[♥A, ♣2, ♠9, ♥4]`
3. **Player B** plays `♠3`:
   - `♥A (1) + ♣2 = 3`!
   - Player B **eats** `♥A`, `♣2`, and their `♠3` into their bank (+3 Gadha points).
   - Table now has: `[♠9, ♥4]`
4. **Player C** plays `♦K (13)`:
   - `♥4 + ♠9 = 13`!
   - Player C **eats** `♥4`, `♠9`, and `♦K` (+9 Gadha points).
   - Table is now empty!

### 4. Wildcard Jokers
- Jokers can substitute for any rank from **1 to 13 (Ace through King)**.
- Since Jokers are non-spade, they give **0 Gadha points**.

### 5. Crown of the "International Gadha"
- When all cards from hands are exhausted, each player's bank is tallied.
- The player with the **HIGHEST Gadha points** is officially crowned the **INTERNATIONAL GADHA 🫏👑**!
- The player with the lowest score is the Winner 🏆.

---

## 🛠️ Architecture & Features

- **Multiplayer Server:** Node.js + Express + Socket.IO.
- **Client:** React 19 + Vite + Lucide Icons + Canvas Confetti.
- **6-Digit Alphanumeric Room Codes:** Easy to copy and share (`?room=XYZ123`).
- **AI Bot Integration:** Host can add bots to test or play solo or with fewer friends.
- **Card Sorting & Arrangement:**
  - Sort by **Rank (A to K)**
  - Sort by **Suit (♠ ♥ ♦ ♣)**
  - Sort by **Spades First (Danger Priority)**
  - Manual card reordering with step buttons
- **Strategy Radar:** Real-time hints showing which cards in your hand are SAFE vs. which cards will eat and how many Gadha points are at risk.
- **Persistent Sessions:**
  - Browser refresh, back button, or network drops do **not** kick you out of the game!
  - `sessionToken` + `playerId` restore your exact seat, hand, and turn instantly.
- **Web Audio Sound Synthesizer:** Built-in crisp card snaps, safe chimes, danger alarms, victory fanfares, and hilarious donkey "Hee-Haw" sounds without external asset dependencies.
- **Responsive Mobile & Desktop Design:** Luxurious casino-felt table, fanned hand, and card animations.

---

## 🚀 Running the Game

### Start the Game Server
In the root directory:
```bash
npm start
```
The server will start on **`http://localhost:3001`**.

Open your browser and navigate to:
```
http://localhost:3001
```

### Development Mode (with hot-reload)
To run client and server independently during development:
```bash
# Terminal 1: Backend Server
npm run dev:server

# Terminal 2: Vite React Frontend
npm run dev:client
```

---

## 📱 Future App Conversion (Capacitor / Cordova / React Native)
Because this project is built as a responsive Single Page Application (SPA), converting it into an Android / iOS app is straightforward:
1. Run `npm install @capacitor/core @capacitor/cli`
2. Initialize Capacitor: `npx cap init "International Gadha" com.internationalgadha.app --web-dir client/dist`
3. Add Android/iOS: `npx cap add android`
4. Build and copy: `npm run build && npx cap copy`
5. Open Android Studio: `npx cap open android`

