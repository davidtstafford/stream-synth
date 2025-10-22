# Stream Synth

A desktop application for Twitch integration built with Electron and TypeScript.

## Features

- **Modular Architecture**: Clean separation between Frontend and Backend code
- **Twitch OAuth Integration**: Internal browser authentication (no external browser required)
- **WebSocket Support**: Real-time connection to Twitch EventSub
- **Left Navigation Menu**: Easy navigation between screens
- **Connection Screen**: Configure and authenticate with Twitch

## Project Structure

```
stream-synth/
├── src/
│   ├── backend/
│   │   └── main.ts              # Electron main process
│   └── frontend/
│       ├── components/
│       │   └── Menu.tsx          # Left navigation menu
│       ├── screens/
│       │   └── connection/
│       │       └── connection.tsx # Connection screen
│       ├── app.tsx               # Main React app
│       └── index.html            # HTML template
├── package.json
├── tsconfig.json
└── webpack.config.js
```

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the application:
   ```bash
   npm run build
   ```

3. Run the application:
   ```bash
   npm start
   ```

## Development

To build and run in development mode:
```bash
npm run dev
```

## Getting a Twitch Client ID

1. Go to https://dev.twitch.tv/console/apps
2. Register a new application
3. Set the OAuth Redirect URL to `http://localhost`
4. Copy your Client ID
5. Paste it into the Connection screen in the app

## Usage

1. Launch the application
2. Navigate to the "Connection" screen (default)
3. Enter your Twitch Client ID
4. Click "Connect to Twitch"
5. Authenticate in the internal browser window
6. The app will establish a WebSocket connection to Twitch EventSub

## Technologies

- **Electron**: Desktop application framework
- **TypeScript**: Type-safe JavaScript
- **React**: UI framework
- **WebSocket (ws)**: Real-time communication
- **Webpack**: Module bundler
