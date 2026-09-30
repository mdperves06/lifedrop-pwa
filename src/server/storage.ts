import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/server/env";
import { ApiError } from "@/server/http";

// Local-disk storage for small user images. Replace with object storage (S3/R2)
// for multi-instance deployments — only these three functions need to change.

const MAX_BYTES = 1024 * 1024;
const NAME_RE = /^[a-z0-9]{20,40}-[a-f0-9]{16}\.(png|jpg|webp)$/;
const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

function sniff(buf: Buffer): "png" | "jpg" | "webp" | null {
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "webp";
  return null;
}

const dir = () => path.resolve(env.uploadDir, "avatars");

export async function saveAvatar(userId: string, file: File) {
  if (file.size > MAX_BYTES) throw new ApiError(413, "TOO_LARGE", "Image must be 1 MB or smaller.", { file: "Max 1 MB" });
  const buf = Buffer.from(await file.arrayBuffer());
  // Trust the bytes, not the client-declared MIME type or filename.
  const ext = sniff(buf);
  if (!ext) throw new ApiError(415, "UNSUPPORTED_TYPE", "Upload a PNG, JPEG or WebP image.", { file: "Unsupported type" });
  const name = `${userId.toLowerCase()}-${randomBytes(8).toString("hex")}.${ext}`;
  await mkdir(dir(), { recursive: true });
  await writeFile(path.join(dir(), name), buf, { flag: "wx" });
  return `/api/avatars/${name}`;
}

export async function readAvatar(name: string) {
  if (!NAME_RE.test(name)) return null;
  try {
    const data = await readFile(path.join(dir(), name));
    return { data, type: TYPES[name.split(".").pop()!] };
  } catch {
    return null;
  }
}

export async function removeAvatar(publicPath: string) {
  const name = publicPath.split("/").pop() ?? "";
  if (!NAME_RE.test(name)) return;
  await unlink(path.join(dir(), name)).catch(() => {});
}
