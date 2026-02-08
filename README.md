# Petmaza Backend

Backend API for Petmaza - Your ultimate pet care platform.

## Tech Stack

- Node.js
- Express.js
- TypeScript
- MongoDB with Mongoose

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Update the `.env` file with your configuration

4. Run the development server:
```bash
npm run dev
```

Server will start on http://localhost:5000

## API Endpoints

- `GET /` - Welcome message
- `GET /api/health` - Health check

## Build for Production

```bash
npm run build
npm start
```
