import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Archive,
  Download,
  FileIcon,
  Lock,
  ShieldCheck,
  Trash2,
  Upload,
  Eye,
  EyeOff,
  KeyRound,
  FileUp,
} from "lucide-react";
import {
  type CompressionLevel,
  type FileEntry,
  decryptPayload,
  downloadBlob,
  encryptPayload,
  formatBytes,
  readFileEntry,
  zipAsync,
} from "@/lib/n7z";
import { unzip } from "fflate";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "n7z — Private in-browser compression with AES-256" },
      {
        name: "description",
        content:
          "Compress files into ZIP archives with adjustable levels and optional AES-256 password protection. Runs entirely in your browser — files never leave your device.",
      },
      { property: "og:title", content: "n7z — Private in-browser compression" },
      {
        property: "og:description",
        content:
          "ZIP compression with AES-256 encryption, 100% client-side. Privacy first.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: N7ZApp,
});

type Mode = "compress" | "decrypt";

interface QueuedFile extends FileEntry {
  id: string;
  size: number;
}

function N7ZApp() {
  const [mode, setMode] = useState<Mode>("compress");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto w-full max-w-4xl px-4 pb-24 pt-8 sm:pt-12">
        <Hero />
        <div className="mt-8 inline-flex rounded-lg border border-border bg-card p-1">
          <TabButton active={mode === "compress"} onClick={() => setMode("compress")}>
            <Archive className="h-4 w-4" /> Compress
          </TabButton>
          <TabButton active={mode === "decrypt"} onClick={() => setMode("decrypt")}>
            <KeyRound className="h-4 w-4" /> Decrypt .n7z
          </TabButton>
        </div>
        <div className="mt-6">
          {mode === "compress" ? <CompressPanel /> : <DecryptPanel />}
        </div>
        <PrivacyFooter />
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Archive className="h-5 w-5" />
          </div>
          <div>
            <div className="text-base font-semibold leading-none">n7z</div>
            <div className="mt-1 text-xs text-muted-foreground">private compression</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>100% in browser</span>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <div className="space-y-3">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Compress and encrypt, right in your browser.
      </h1>
      <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
        Drop files, pick a compression level, and optionally lock the archive with
        AES-256. Nothing is uploaded — everything happens on your device.
      </p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/* ------------------------------ Compress ------------------------------ */

function CompressPanel() {
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [level, setLevel] = useState<CompressionLevel>(6);
  const [encrypt, setEncrypt] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [archiveName, setArchiveName] = useState("archive");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ size: number; ratio: number } | null>(null);

  const totalSize = useMemo(() => files.reduce((s, f) => s + f.size, 0), [files]);

  const onFilesChosen = useCallback(async (fileList: FileList | File[]) => {
    setError(null);
    setResult(null);
    const arr = Array.from(fileList);
    const entries = await Promise.all(arr.map(readFileEntry));
    const queued: QueuedFile[] = entries.map((e, i) => ({
      ...e,
      id: `${Date.now()}-${i}-${e.path}`,
      size: e.data.byteLength,
    }));
    setFiles((prev) => [...prev, ...queued]);
  }, []);

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));
  const clearAll = () => {
    setFiles([]);
    setResult(null);
    setError(null);
  };

  const canCompress =
    files.length > 0 &&
    !busy &&
    (!encrypt || (password.length >= 4 && password === confirmPw));

  const run = async () => {
    setError(null);
    setResult(null);
    setBusy(true);
    setProgress(0);
    try {
      const zipped = await zipAsync(files, level, setProgress);
      let out = zipped;
      let filename = `${archiveName || "archive"}.zip`;
      let mime = "application/zip";
      if (encrypt) {
        out = await encryptPayload(zipped, password);
        filename = `${archiveName || "archive"}.n7z`;
        mime = "application/octet-stream";
      }
      downloadBlob(out, filename, mime);
      setResult({
        size: out.byteLength,
        ratio: totalSize > 0 ? (1 - out.byteLength / totalSize) * 100 : 0,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Compression failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Dropzone onFiles={onFilesChosen} />

      {files.length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="text-sm">
              <span className="font-medium">{files.length}</span> file
              {files.length === 1 ? "" : "s"} ·{" "}
              <span className="text-muted-foreground">{formatBytes(totalSize)}</span>
            </div>
            <button
              onClick={clearAll}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              Clear all
            </button>
          </div>
          <ul className="max-h-64 divide-y divide-border overflow-auto">
            {files.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm">{f.path}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{formatBytes(f.size)}</span>
                  <button
                    onClick={() => removeFile(f.id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 rounded-lg border border-border bg-card p-5 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Archive name</label>
          <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
            <input
              value={archiveName}
              onChange={(e) => setArchiveName(e.target.value.replace(/[^\w.\-]/g, ""))}
              className="min-w-0 flex-1 rounded-md bg-transparent px-3 py-2 text-sm outline-none"
              placeholder="archive"
            />
            <span className="pr-3 text-xs text-muted-foreground">
              .{encrypt ? "n7z" : "zip"}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Compression level</label>
            <span className="text-xs text-muted-foreground">
              {level} · {levelLabel(level)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={9}
            value={level}
            onChange={(e) => setLevel(Number(e.target.value) as CompressionLevel)}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
            <span>Store</span>
            <span>Balanced</span>
            <span>Max</span>
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={encrypt}
              onChange={(e) => setEncrypt(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <Lock className="h-4 w-4" />
            Password protect (AES-256-GCM, PBKDF2 · 250k)
          </label>
          {encrypt && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password (min 4 chars)"
                  className="min-w-0 flex-1 rounded-md bg-transparent px-3 py-2 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="pr-3 text-muted-foreground hover:text-foreground"
                  aria-label="Toggle visibility"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <input
                type={showPw ? "text" : "password"}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Confirm password"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              {password && confirmPw && password !== confirmPw && (
                <p className="text-xs text-destructive sm:col-span-2">
                  Passwords don't match.
                </p>
              )}
              <p className="text-xs text-muted-foreground sm:col-span-2">
                The archive uses the n7z format — decrypt it here with your password.
                Lose the password and the data is unrecoverable.
              </p>
            </div>
          )}
        </div>
      </div>

      {busy && (
        <div className="space-y-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {progress < 100 ? "Compressing…" : "Finalizing…"}
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {result && !busy && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
          Archive ready — {formatBytes(result.size)}{" "}
          {result.ratio > 0 && (
            <span className="text-muted-foreground">
              (saved {result.ratio.toFixed(1)}%)
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={run}
          disabled={!canCompress}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {encrypt ? "Compress & encrypt" : "Compress"}
        </button>
      </div>
    </div>
  );
}

function levelLabel(l: CompressionLevel): string {
  if (l === 0) return "no compression";
  if (l <= 3) return "fast";
  if (l <= 6) return "balanced";
  return "maximum";
}

/* ------------------------------ Dropzone ------------------------------ */

function Dropzone({ onFiles }: { onFiles: (f: FileList | File[]) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors ${
        dragging
          ? "border-primary bg-primary/5"
          : "border-border bg-card hover:border-primary/50"
      }`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Upload className="h-6 w-6" />
      </div>
      <p className="mt-4 text-sm font-medium">
        Drop files here or click to select
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Multiple files supported · nothing leaves your device
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/* ------------------------------ Decrypt ------------------------------ */

function DecryptPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<{ name: string; data: Uint8Array }[] | null>(
    null,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setExtracted(null);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const zipData = await decryptPayload(buf, password);
      const files = await new Promise<{ name: string; data: Uint8Array }[]>(
        (resolve, reject) => {
          unzip(zipData, (err, unzipped) => {
            if (err) return reject(err);
            resolve(
              Object.entries(unzipped).map(([name, data]) => ({ name, data })),
            );
          });
        },
      );
      setExtracted(files);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decryption failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div
        onClick={() => inputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-card px-6 py-10 text-center hover:border-primary/50"
      >
        <FileUp className="h-8 w-8 text-primary" />
        <p className="mt-3 text-sm font-medium">
          {file ? file.name : "Select an .n7z archive"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {file ? formatBytes(file.size) : "Encrypted archives produced by n7z"}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".n7z,application/octet-stream"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setFile(f);
              setExtracted(null);
              setError(null);
            }
          }}
        />
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <label className="text-sm font-medium">Password</label>
        <div className="mt-2 flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
          <input
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter archive password"
            className="min-w-0 flex-1 rounded-md bg-transparent px-3 py-2 text-sm outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="pr-3 text-muted-foreground hover:text-foreground"
          >
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <button
        onClick={run}
        disabled={!file || !password || busy}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <KeyRound className="h-4 w-4" />
        {busy ? "Decrypting…" : "Decrypt archive"}
      </button>

      {extracted && (
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3 text-sm font-medium">
            {extracted.length} file{extracted.length === 1 ? "" : "s"} extracted
          </div>
          <ul className="max-h-72 divide-y divide-border overflow-auto">
            {extracted.map((f) => (
              <li key={f.name} className="flex items-center justify-between gap-3 px-4 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm">{f.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {formatBytes(f.data.byteLength)}
                  </span>
                  <button
                    onClick={() =>
                      downloadBlob(
                        f.data,
                        f.name.split("/").pop() || f.name,
                        "application/octet-stream",
                      )
                    }
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Download
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Footer ------------------------------ */

function PrivacyFooter() {
  return (
    <div className="mt-16 grid gap-4 sm:grid-cols-3">
      <FeatureCard
        icon={<ShieldCheck className="h-5 w-5" />}
        title="Zero uploads"
        desc="Files are processed locally in your browser. No servers, no telemetry."
      />
      <FeatureCard
        icon={<Lock className="h-5 w-5" />}
        title="AES-256-GCM"
        desc="Password-derived keys via PBKDF2-SHA-256, 250k iterations."
      />
      <FeatureCard
        icon={<Archive className="h-5 w-5" />}
        title="Standard ZIP"
        desc="Plain archives open with any unzipper. Encrypted archives use .n7z."
      />
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}
