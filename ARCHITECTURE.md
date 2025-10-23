# Stream Synth Application Structure

## Visual Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Stream Synth                                           ─ □ ×│
├─────────────────────────────────────────────────────────────┤
│           │                                                  │
│           │  Connection                                      │
│ Menu      │  ─────────────────────────────────────────────  │
│ (200px)   │                                                  │
│           │  Twitch Client ID                                │
│ ┌────────┤  ┌─────────────────────────────────────────┐    │
│ │Connect │  │ Enter your Twitch Client ID             │    │
│ │ion     │  └─────────────────────────────────────────┘    │
│ └────────┤                                                  │
│           │  ┌──────────────────────┐                       │
│           │  │ Connect to Twitch    │                       │
│           │  └──────────────────────┘                       │
│           │                                                  │
│           │  [Status messages appear here]                  │
│           │                                                  │
│           │                                                  │
│           │                                                  │
└───────────┴──────────────────────────────────────────────────┘
```

## Component Architecture

```
App (app.tsx)
├── Menu (components/Menu.tsx)
│   └── Menu Items
│       └── Connection (active)
└── Screen Router
    └── ConnectionScreen (screens/connection/connection.tsx)
        ├── Client ID Input
        ├── Connect Button
        ├── Status Messages
        └── WebSocket Handler
```

## Backend Architecture

```
Electron Main Process (backend/main.ts)
├── Window Management
│   └── BrowserWindow creation
├── IPC Handlers
│   ├── twitch-oauth
│   │   └── Opens internal auth window
│   │   └── Returns access token
│   └── connect-websocket
│       └── Manages WebSocket connection
└── OAuth Flow
    ├── Opens Twitch OAuth URL
    ├── Captures redirect with token
    └── Returns to frontend
```

## Data Flow

```
User Input (Client ID)
    ↓
Click "Connect to Twitch"
    ↓
Frontend → IPC Call → Backend
    ↓
Electron opens internal auth window
    ↓
User authenticates on Twitch
    ↓
Twitch redirects with token
    ↓
Backend captures token → Frontend
    ↓
Frontend initiates WebSocket connection
    ↓
Connected to Twitch EventSub
```

## Technologies Used

- **Frontend**: React + TypeScript
- **Backend**: Electron (Node.js)
- **Styling**: CSS (embedded in HTML)
- **Build**: TypeScript Compiler + Webpack
- **Communication**: Electron IPC
- **Realtime**: WebSocket (ws library)
