# iDesk - Antigravity Helpdesk System

## Project Structure
The project follows a monorepo structure:
- `apps/backend`: NestJS Backend Application (Port 5050)
- `apps/frontend`: React/Vite Frontend Application (Port 4050)
- `startup.bat`: Windows One-Click Startup Script
- `package.json`: Root configuration for cross-platform startup

## Quick Start

### Option 1: Windows One-Click (Recommended)
Double-click the `startup.bat` file in the root directory.
This will:
1. Launch the Backend in a new terminal.
2. Launch the Frontend in a new terminal.
3. Automatically open your default browser to `http://localhost:4050`.

### Option 2: Cross-Platform (Node.js)
If you prefer using the terminal or are on Mac/Linux:

1. Install dependencies (first time only):
   ```bash
   npm install
   npm run install:all
   ```

2. Start the development environment:
   ```bash
   npm start
   ```
   This uses `concurrently` to run both services in a single terminal window.

## Prerequisites
- Node.js (v18+)
- Docker (for Database)
- PostgreSQL (running via Docker)
