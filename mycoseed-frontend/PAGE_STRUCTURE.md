# MycoSeed Pixel World Structure

## 🍄 Design Philosophy
- **Style**: 8-bit Retro Game (Super Mario inspired).
- **Concept**: "Mutual Aid as Gameplay".
- **Core**: Network Graph (Mycelium) + Village Metaphor.

## 🗺 Page Map

### 1. Home: The Network (`/`)
- **Visual**: Dynamic Force-Directed Graph (D3.js).
- **Nodes**: Users (Mushrooms) & Communities (Houses).
- **Interactions**: Click to travel to Village or User House.
- **UI**: Pixel Search Bar + Stats Overlay.

### 2. Community: The Village (`/community/[id]`)
- **Metaphor**: A pixel art village view.
- **Features**:
  - **Quest Board**: List of Offers & Needs.
  - **Town Hall**: Governance & Membership.
  - **Stats**: Population & Level.

### 3. User: The Pixel House (`/member/[id]`)
- **Metaphor**: A personal pixel house.
- **Features**:
  - **Avatar**: Generated pixel art.
  - **Stats Card**: XP, Level, Contributions (STR/INT/LUCK).
  - **Inventory**: NFT Badges & Items.

### 4. Quest Board (`/dashboard` or embedded)
- **Style**: Notice Board / Bounty Hunter Board.
- **Action**: Post Offer / Need.

### 5. Auth: Start Game (`/auth/login`)
- **Style**: "Insert Coin" / "Start Game" screen.
- **Method**: Phone + Web3 AA Wallet (Auto-generated).

## 🎨 Component Library (`components/pixel/`)
- `PixelButton.vue`: Retro buttons with pressed states.
- `PixelCard.vue`: Containers with black borders and shadows.
- `PixelAvatar.vue`: Deterministic pixel art generator.
- `NetworkCanvas.vue`: D3.js graph implementation.

## 🛠 Setup
Requires D3.js:
```bash
yarn add d3 @types/d3
```
