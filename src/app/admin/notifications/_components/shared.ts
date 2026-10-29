import { api } from "@/lib/api-client";

export type NotificationType =
  | "campaign"
  | "chat"
  | "order"
  | "referral"
  | "wallet"
  | "profile"
  | "offer"
  | "system";

export type TargetMode = "all" | "brands" | "influencers" | "users";

export type BroadcastTarget =
  | { mode: "all" }
  | { mode: "brands" }
  | { mode: "influencers" }
  | { mode: "users"; userIds: string[] };

export type BroadcastStatus = "sent" | "scheduled" | "sending" | "failed" | "cancelled";

export interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: "influencer" | "brand" | "admin";
}

export interface Broadcast {
  id: string;
  title: string | null;
  body: string | null;
  imageUrl: string | null;
  deepLink: string | null;
  type: NotificationType;
  targetMode: TargetMode;
  targetUserIds: string[] | null;
  status: BroadcastStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  recipients: number;
  devices: number;
  sent: number;
  failed: number;
  error: string | null;
  createdBy: string | null;
  authorName: string | null;
  resentFromId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PushTemplate {
  id: string;
  name: string;
  title: string | null;
  body: string | null;
  imageUrl: string | null;
  deepLink: string | null;
  type: NotificationType;
  createdAt: string;
  updatedAt: string;
}

export interface AudienceReach {
  users: number;
  reachable: number;
  ios: number;
  android: number;
  web: number;
}

/** The message fields the compose form can be pre-filled with, from a template or a resend. */
export interface ComposeSeed {
  title: string;
  body: string;
  imageUrl: string;
  deepLink: string;
  type: NotificationType;
  targetMode?: TargetMode;
  targetUserIds?: string[];
}

export const NOTIFICATION_TYPES: { value: NotificationType; label: string }[] = [
  { value: "offer", label: "Offer / Promotion" },
  { value: "system", label: "System Announcement" },
  { value: "campaign", label: "Campaign" },
  { value: "chat", label: "Chat" },
  { value: "order", label: "Order" },
  { value: "referral", label: "Referral" },
  { value: "wallet", label: "Wallet" },
  { value: "profile", label: "Profile" },
];

export const TARGET_OPTIONS: { value: TargetMode; label: string }[] = [
  { value: "all", label: "All users" },
  { value: "brands", label: "All brands" },
  { value: "influencers", label: "All influencers" },
  { value: "users", label: "Specific users" },
];

export const TARGET_LABELS: Record<TargetMode, string> = {
  all: "All users",
  brands: "All brands",
  influencers: "All influencers",
  users: "Specific users",
};

export const STATUS_STYLES: Record<BroadcastStatus, { label: string; className: string }> = {
  sent: {
    label: "Sent",
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  },
  scheduled: {
    label: "Scheduled",
    className: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  },
  sending: {
    label: "Sending",
    className: "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400",
  },
  failed: {
    label: "Failed",
    className: "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-400",
  },
};

/** Past this, an Android notification image is likely to be dropped when it is decoded. */
export const NOTIFICATION_IMAGE_WARN_BYTES = 1024 * 1024;

export const broadcastToSeed = (broadcast: Broadcast): ComposeSeed => ({
  title: broadcast.title ?? "",
  body: broadcast.body ?? "",
  imageUrl: broadcast.imageUrl ?? "",
  deepLink: broadcast.deepLink ?? "",
  type: broadcast.type,
  targetMode: broadcast.targetMode,
  targetUserIds: broadcast.targetUserIds ?? [],
});

export const templateToSeed = (template: PushTemplate): ComposeSeed => ({
  title: template.title ?? "",
  body: template.body ?? "",
  imageUrl: template.imageUrl ?? "",
  deepLink: template.deepLink ?? "",
  type: template.type,
});

export const buildTarget = (mode: TargetMode, userIds: string[]): BroadcastTarget =>
  mode === "users" ? { mode: "users", userIds } : { mode };

/**
 * Unwraps the API envelope, surfacing the server's own error text.
 *
 * The panel leans on those messages heavily here — "none of them has the app installed"
 * is far more useful to an admin than a generic failure toast.
 */
export async function apiJson<T>(path: string, options?: RequestInit): Promise<{ data: T; message?: string }> {
  const res = await api(path, options);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !(json as any).success) {
    throw new Error((json as any).error || "Request failed");
  }
  return { data: (json as any).data as T, message: (json as any).message as string | undefined };
}

export async function apiJsonBody<T>(path: string, method: string, body?: unknown) {
  return apiJson<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const formatDateTime = (value: string | null): string => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** "2 hours ago" style stamp for the history rows, falling back to the absolute date. */
export const formatRelative = (value: string | null): string => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (Math.abs(minutes) < 1) return "just now";
  if (Math.abs(minutes) < 60) return `${minutes > 0 ? "" : "in "}${Math.abs(minutes)}m${minutes > 0 ? " ago" : ""}`;

  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return `${hours > 0 ? "" : "in "}${Math.abs(hours)}h${hours > 0 ? " ago" : ""}`;

  const days = Math.round(hours / 24);
  if (Math.abs(days) < 7) return `${days > 0 ? "" : "in "}${Math.abs(days)}d${days > 0 ? " ago" : ""}`;

  return formatDateTime(value);
};

/**
 * Converts a value from `<input type="datetime-local">` into an ISO string.
 *
 * The input hands back a local wall-clock time with no zone; `new Date()` reads it in the
 * browser's zone, which is what the admin meant when they picked it.
 */
export const localInputToIso = (value: string): string | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
