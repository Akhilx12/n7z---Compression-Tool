# n7z

A privacy-first, browser-based compression tool. ZIP your files with adjustable compression levels and optionally lock them with AES-256 password protection. Everything runs locally — nothing is uploaded to a server.

[![Bun](https://img.shields.io/badge/bun-1.3.3-black?logo=bun)](https://bun.sh)
[![React](https://img.shields.io/badge/react-19-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/typescript-5.8-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## Features

- **Local-first compression** — ZIP archives created entirely in your browser using [`fflate`](https://github.com/101arrowz/fflate).
- **Adjustable compression levels** — 0 (store) to 9 (maximum) with a live slider.
- **AES-256-GCM encryption** — Optional password protection using PBKDF2-SHA256 with 250,000 iterations.
- **Custom `.n7z` encrypted format** — ZIP payload encrypted and wrapped with a magic header, salt, IV, and ciphertext.
- **Drag & drop interface** — Add files quickly, review the list, remove items, and download the final archive.
- **Decryption panel** — Load an `.n7z` archive and extract the original ZIP with the correct password.
- **Zero uploads** — No cloud, no tracking, no telemetry. Your files never leave your device.

---

## Tech Stack

- [TanStack Start](https://tanstack.com/start) — full-stack React framework with SSR support
- [React 19](https://react.dev) — UI library
- [Tailwind CSS v4](https://tailwindcss.com) — utility-first styling
- [fflate](https://github.com/101arrowz/fflate) — fast JavaScript compression
- [WebCrypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) — AES-256-GCM, PBKDF2, secure random values
- [Bun](https://bun.sh) — package manager and runtime

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) installed on your machine

### Install

```bash
git clone https://github.com/Akhilx12/n7z.git
cd n7z
bun install
```

### Run locally

```bash
bun run dev
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

### Build for production

```bash
bun run build
```

### Preview the production build

```bash
bun run preview
```

---

## Available Scripts

| Script | Description |
| --- | --- |
| `bun run dev` | Start the development server |
| `bun run build` | Build for production |
| `bun run build:dev` | Build in development mode |
| `bun run preview` | Preview the production build |
| `bun run lint` | Run ESLint |
| `bun run format` | Format code with Prettier |

---

## How It Works

### Compression

1. Select files via drag-and-drop or the file picker.
2. Choose a compression level (`0` store, `1–3` fast, `4–6` balanced, `7–9` maximum).
3. Optionally enable password protection.
4. Click **Compress** to download a `.zip` file, or **Compress & encrypt** to download a `.n7z` file.

### Encryption Format

Encrypted `.n7z` archives have this binary layout:

```
[ 5 bytes ]  N7Z1 magic header
[ 16 bytes ] Salt
[ 12 bytes ] IV
[ ... ]      AES-256-GCM ciphertext + 16-byte auth tag
```

The key is derived from the password using **PBKDF2-SHA256 with 250,000 iterations**.

### Decryption

1. Switch to the **Decrypt .n7z** tab.
2. Select an `.n7z` archive.
3. Enter the password and extract the files.

---

## Security Notes

- Passwords are **never stored** anywhere.
- Encryption is performed with the **WebCrypto API** in your browser.
- If you lose the password, the archive contents are **unrecoverable**.
- The `.n7z` format is custom to this tool. Use the decrypt panel here to open it.
- ZIP output is standard and can be opened by any archive utility.

---

## Privacy

n7z is designed to be **privacy-first**:

- No backend server required.
- No files are uploaded.
- No analytics or telemetry.
- All processing happens in your browser using the WebCrypto API.

---

## Project Structure

```text
n7z/
├── src/
│   ├── lib/
│   │   ├── n7z.ts          # Compression, encryption, and utilities
│   │   ├── utils.ts        # Tailwind class helpers
│   │   ├── error-capture.ts  # SSR error capture
│   │   └── error-page.ts     # SSR error page rendering
│   ├── routes/
│   │   ├── __root.tsx      # Root layout and metadata
│   │   └── index.tsx       # Main app UI
│   ├── router.tsx          # Router setup
│   ├── server.ts           # Server entry
│   ├── start.ts            # TanStack Start configuration
│   └── styles.css          # Tailwind v4 design tokens
├── public/
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## Roadmap

- [ ] Folder / directory compression
- [ ] Multiple archive formats (7z, tar.gz)
- [ ] Batch `.n7z` decryption
- [ ] Offline PWA support
- [ ] Multi-file extraction with individual download links

---

## Contributing

Contributions are welcome. Please open an issue or submit a pull request.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "Add your feature"`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a pull request

---

## License

[MIT](LICENSE)

---

## Acknowledgments

- [fflate](https://github.com/101arrowz/fflate) for the fast in-browser compression library
- [TanStack Start](https://tanstack.com/start) for the modern React framework
- [WebCrypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) for the built-in cryptographic primitives
