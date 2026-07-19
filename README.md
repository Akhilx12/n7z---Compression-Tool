# n7z

Privacy-focused, in-browser file compression with optional AES-256-GCM password protection. All compression and encryption happens locally in your browser — no files are ever uploaded.

## Features

- ZIP archive creation with adjustable compression levels (0–9)
- Optional AES-256-GCM encryption (PBKDF2-SHA256, 250k iterations) wrapped in a `.n7z` container
- Decrypt `.n7z` archives back to a ZIP
- 100% client-side; works offline once loaded

## Tech stack

- React 19 + TanStack Start (Vite 8)
- Tailwind CSS v4
- [`fflate`](https://github.com/101arrowz/fflate) for ZIP
- WebCrypto for AES-256-GCM + PBKDF2

## Getting started

```bash
# install deps (bun, pnpm, or npm all work)
bun install

# start dev server on http://localhost:8080
bun run dev

# production build
bun run build
bun run preview
```

## Project structure

```
src/
  routes/          TanStack file-based routes (__root.tsx, index.tsx)
  lib/n7z.ts       ZIP + AES-256-GCM core
  server.ts        SSR entry
  start.ts         Request middleware
  router.tsx       Router bootstrap
  styles.css       Tailwind v4 theme
```
