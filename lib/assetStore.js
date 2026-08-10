// Local (on-disk) media storage for the VPS-hosted backend.
//
// New uploads are written under `public/uploads/<folder>/<uuid>.<ext>` and
// served statically by index.js at `${PUBLIC_UPLOAD_BASE}/uploads/...`.
// Existing assets that still live on Cloudinary keep working untouched — only
// NEW uploads land on local disk. `destroyAsset` transparently deletes from
// whichever backing store an asset came from (local vs Cloudinary), decided by
// the shape of its public_id (local ids are prefixed with "uploads/").
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import crypto from "crypto";
import sharp from "sharp";
import { v2 as cloudinary } from "cloudinary";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// public/            <- served static content root (index.js mounts /uploads)
// public/uploads/    <- everything created here is web-accessible
export const PUBLIC_DIR = path.join(__dirname, "..", "public");
export const UPLOADS_ROOT = path.join(PUBLIC_DIR, "uploads");

const VIDEO_EXTS = new Set([".mp4", ".webm", ".mov", ".ogg", ".m4v"]);

// Absolute base URL that fronts the /uploads static route — this is baked into
// every stored image URL, so it MUST point at the public backend host. Set
// PUBLIC_UPLOAD_BASE per environment (e.g. http://localhost:5000 in dev). We
// intentionally do NOT fall back to BACKEND_URL, which is localhost in dev and
// would poison stored URLs. The default is the production API host.
function publicBase() {
  return (process.env.PUBLIC_UPLOAD_BASE || "https://api.applebd.com").replace(
    /\/+$/,
    "",
  );
}

// Turn an arbitrary folder string ("applebd/products") into a safe relative
// path with no traversal, empty, or unexpected characters.
function sanitizeFolder(folder) {
  const cleaned = String(folder || "")
    .replace(/\\/g, "/")
    .split("/")
    .map((seg) => seg.replace(/[^a-zA-Z0-9_-]/g, ""))
    .filter(Boolean)
    .join("/");
  return cleaned || "misc";
}

// Local public_ids are the file path relative to `public/`, e.g.
// "uploads/applebd/products/ab12.webp". Cloudinary ids never start with that.
export function isLocalPublicId(publicId) {
  return typeof publicId === "string" && publicId.startsWith("uploads/");
}

let cloudinaryConfigured = false;
function ensureCloudinaryConfigured() {
  if (!cloudinaryConfigured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    cloudinaryConfigured = true;
  }
}

// Store an uploaded file on local disk. Images are optimized to webp with sharp
// (mirrors the old server-side Cloudinary pipeline); videos are stored as-is.
// Returns the same asset shape the frontend/DB already expect.
export async function saveLocalUpload({
  buffer,
  mimetype,
  originalName,
  folder,
}) {
  const rel = sanitizeFolder(folder);
  const dir = path.join(UPLOADS_ROOT, rel);
  await fs.mkdir(dir, { recursive: true });

  const id = crypto.randomUUID();
  const isVideo = String(mimetype || "").startsWith("video/");

  if (isVideo) {
    const ext = (path.extname(originalName || "") || ".mp4").toLowerCase();
    const filename = `${id}${ext}`;
    await fs.writeFile(path.join(dir, filename), buffer);
    const publicId = `uploads/${rel}/${filename}`;
    return {
      public_id: publicId,
      url: `${publicBase()}/${publicId}`,
      format: ext.replace(".", ""),
      resourceType: "video",
    };
  }

  const maxWidth = Number(process.env.IMG_MAX_WIDTH) || 1600;
  const quality = Number(process.env.IMG_QUALITY) || 75;
  const { data, info } = await sharp(buffer)
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality })
    .toBuffer({ resolveWithObject: true });

  const filename = `${id}.webp`;
  await fs.writeFile(path.join(dir, filename), data);
  const publicId = `uploads/${rel}/${filename}`;
  return {
    public_id: publicId,
    url: `${publicBase()}/${publicId}`,
    width: info.width,
    height: info.height,
    format: "webp",
    resourceType: "image",
  };
}

// Delete a locally-stored file. No-op (returns false) for non-local ids.
export async function deleteLocalAsset(publicId) {
  if (!isLocalPublicId(publicId)) return false;
  const full = path.join(PUBLIC_DIR, publicId.replace(/^\/+/, ""));
  // Guard against path traversal — must resolve inside the uploads root.
  if (!full.startsWith(UPLOADS_ROOT)) return false;
  await fs.unlink(full).catch(() => {});
  return true;
}

// Delete an asset from whichever store it lives in. Safe to call for either
// local or legacy Cloudinary ids. Errors are swallowed (best-effort cleanup).
export async function destroyAsset(publicId, opts = {}) {
  if (!publicId) return;
  if (isLocalPublicId(publicId)) {
    await deleteLocalAsset(publicId);
    return;
  }
  try {
    ensureCloudinaryConfigured();
    await cloudinary.uploader.destroy(publicId, opts);
  } catch {
    /* ignore Cloudinary errors */
  }
}

// List locally-stored media (for the admin Media Library), optionally scoped to
// a folder prefix and filtered by a query string. Returns newest-first.
export async function listLocalMedia({ folder = "", q = "" } = {}) {
  const prefix = folder ? sanitizeFolder(folder) : "";
  const start = prefix ? path.join(UPLOADS_ROOT, prefix) : UPLOADS_ROOT;
  const results = [];

  async function walk(dir, relPrefix) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return; // folder doesn't exist yet
    }
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      const rel = relPrefix ? `${relPrefix}/${e.name}` : e.name;
      if (e.isDirectory()) {
        await walk(abs, rel);
        continue;
      }
      const stat = await fs.stat(abs).catch(() => null);
      if (!stat) continue;
      const ext = path.extname(e.name).toLowerCase();
      const isVideo = VIDEO_EXTS.has(ext);
      results.push({
        public_id: `uploads/${rel}`,
        url: `${publicBase()}/uploads/${rel}`,
        resource_type: isVideo ? "video" : "image",
        bytes: stat.size,
        format: ext.replace(".", ""),
        created_at: stat.mtime.toISOString(),
        folder: rel.split("/").slice(0, -1).join("/"),
      });
    }
  }

  await walk(start, prefix);
  let items = results;
  if (q) {
    const lower = q.toLowerCase();
    items = items.filter((i) => i.public_id.toLowerCase().includes(lower));
  }
  return items.sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at),
  );
}
