# Teleprompter

A collaborative teleprompter application built with React and WebSocket-based real-time collaboration.

Originally based on https://github.com/jlecomte/voice-activated-teleprompter

## Architecture

This is a monorepo containing:

- **Frontend** (`apps/frontend`): React application built with Vite
- **Backend** (`apps/backend`): WebSocket collaboration server using Hocuspocus
- **Shared** (`packages/shared`): Shared types and utilities

## Development

### Prerequisites

- Node.js 18+
- npm

### Getting Started

1. Install dependencies:

```bash
npm install
```

2. Start development servers:

```bash
# Start both frontend and backend
npm run dev

# Or start individually
npm run dev:frontend
npm run dev:backend
```

3. Open your browser:

- Frontend: http://localhost:5173 (or http://localhost:5174 if 5173 is busy)
- Backend WebSocket: ws://localhost:8080

### Building

```bash
# Build all packages
npm run build

# Build individually
npm run build:frontend
npm run build:backend
```

## Workspace Structure

```
teleprompter/
├── apps/
│   ├── frontend/          # React frontend application
│   └── backend/           # WebSocket collaboration server
├── packages/
│   └── shared/            # Shared TypeScript types and utilities
├── package.json           # Root package.json with workspace configuration
└── README.md
```

## Collaboration

The application uses Yjs and Hocuspocus for real-time collaborative editing. Users can:

- Create collaboration rooms
- Join existing rooms by ID
- Sync text content and position in real-time
- See when other users are connected
