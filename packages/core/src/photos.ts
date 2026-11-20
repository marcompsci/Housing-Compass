/**
 * Listing photo pipeline (manager uploads). Every upload goes to a PRIVATE quarantine bucket,
 * is malware-scanned by a separate service, checked for re-use (dHash) against other listings,
 * and needs the uploader's attestation that they have the right to use it. Only then can it be
 * published. We never copy photos from other websites.
 * Mirrored by the listing_photos table + photo_guard trigger in 20261103000000_v014.sql.
 */
import { hammingHex } from "./trust/fraud";

export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const PHOTO_MIN_SIDE = 400;
export const PHOTO_MAX_SIDE = 8000;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/heic", "image/webp"] as const;
export const PHOTO_DUPLICATE_DISTANCE = 8;
export const PHOTOS_PER_LISTING = 20;

export type PhotoStatus = "quarantined" | "clean" | "infected" | "rejected" | "published";

export interface PhotoUpload {
  mime: string;
  bytes: number;
  width: number;
  height: number;
  rightsAttested: boolean;
}

export type PhotoProblem = "type" | "too_big" | "too_small" | "too_large_dimensions" | "no_attestation";

export function validatePhotoUpload(p: PhotoUpload): PhotoProblem | null {
  if (!(PHOTO_TYPES as readonly string[]).includes(p.mime)) return "type";
  if (p.bytes <= 0 || p.bytes > PHOTO_MAX_BYTES) return "too_big";
  if (Math.min(p.width, p.height) < PHOTO_MIN_SIDE) return "too_small";
  if (Math.max(p.width, p.height) > PHOTO_MAX_SIDE) return "too_large_dimensions";
  if (!p.rightsAttested) return "no_attestation";
  return null;
}

export const PHOTO_PROBLEM_TEXT: Record<PhotoProblem, string> = {
  type: "Use a JPEG, PNG, HEIC or WebP photo.",
  too_big: "Photos must be under 10 MB.",
  too_small: `Photos must be at least ${PHOTO_MIN_SIDE} px on the short side.`,
  too_large_dimensions: `Photos must be at most ${PHOTO_MAX_SIDE} px on the long side.`,
  no_attestation: "Confirm you took this photo or have permission to use it.",
};

export const RIGHTS_ATTESTATION =
  "I took this photo of this property, or I have written permission to use it. It isn't copied from another listing or website.";

export interface StoredPhoto {
  id: string;
  listingId: string;
  status: PhotoStatus;
  dhash: string | null;
  rightsAttested: boolean;
}

/** Other listings' photos within PHOTO_DUPLICATE_DISTANCE bits (same photo, resized or re-encoded). */
export function findReusedPhoto(dhash: string, listingId: string, others: StoredPhoto[]): StoredPhoto | null {
  return others.find((o) => o.listingId !== listingId && o.dhash && o.status !== "rejected" && o.status !== "infected" && hammingHex(dhash, o.dhash) <= PHOTO_DUPLICATE_DISTANCE) ?? null;
}

export type PublishBlock = "not_scanned" | "infected" | "rejected" | "no_attestation" | "no_hash" | "reused";

export function canPublishPhoto(p: StoredPhoto, others: StoredPhoto[]): PublishBlock | null {
  if (p.status === "infected") return "infected";
  if (p.status === "rejected") return "rejected";
  if (p.status === "quarantined") return "not_scanned";
  if (!p.rightsAttested) return "no_attestation";
  if (!p.dhash) return "no_hash";
  if (findReusedPhoto(p.dhash, p.listingId, others)) return "reused";
  return null;
}

/** Storage path inside the private quarantine bucket. No original file names (they can leak PII). */
export function quarantinePath(managerId: string, listingId: string, photoId: string, mime: string): string {
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/heic": "heic", "image/webp": "webp" }[mime] ?? "bin";
  const safe = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, "_");
  return `${safe(managerId)}/${safe(listingId)}/${safe(photoId)}.${ext}`;
}
