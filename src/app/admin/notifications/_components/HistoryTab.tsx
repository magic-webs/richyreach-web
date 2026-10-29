"use client";

import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Copy, RefreshCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api-client";
import { ResendDialog } from "./ResendDialog";
import {
  Broadcast,
  ComposeSeed,
  NOTIFICATION_TYPES,
  STATUS_STYLES,
  TARGET_LABELS,
  broadcastToSeed,
  formatDateTime,
  formatRelative,
} from "./shared";

const PAGE_SIZE = 20;

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "sent", label: "Sent" },
  { value: "scheduled", label: "Scheduled" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

interface HistoryTabProps {
  onDuplicate: (seed: ComposeSeed) => void;
}

export function HistoryTab({ onDuplicate }: HistoryTabProps) {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  // The query key is built from the debounced value, so typing a word costs one request
  // rather than one per keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [resendTarget, setResendTarget] = useState<Broadcast | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Broadcast | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isFetching } = useQuery<{ items: Broadcast[]; total: number }>({
    queryKey: ["pushBroadcasts", { search: debouncedSearch, statusFilter, typeFilter, page }],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);

      const res = await api(`/admin/notifications/broadcasts?${params.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !(json as any).success) {
        throw new Error((json as any).error || "Failed to load history");
      }
      return {
        items: ((json as any).data ?? []) as Broadcast[],
        total: Number((json as any).meta?.pagination?.total ?? 0),
      };
    },
    // Scheduled rows flip to sent on their own, so the list is refreshed while it is open.
    refetchInterval: 60_000,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const hasMore = (page + 1) * PAGE_SIZE < total;

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api(`/admin/notifications/broadcasts/${id}/cancel`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !(json as any).success) throw new Error((json as any).error || "Failed to cancel");
      return json as any;
    },
    onSuccess: (json) => {
      toast.success(json?.message || "Scheduled notification cancelled");
      queryClient.invalidateQueries({ queryKey: ["pushBroadcasts"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to cancel"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api(`/admin/notifications/broadcasts/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !(json as any).success) throw new Error((json as any).error || "Failed to delete");
      return json as any;
    },
    onSuccess: (json) => {
      toast.success(json?.message || "Removed from history");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["pushBroadcasts"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete"),
  });

  const resetPageAnd = (fn: () => void) => {
    setPage(0);
    fn();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => resetPageAnd(() => setSearch(e.target.value))}
            aria-label="Search notification history"
            placeholder="Search title or body..."
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(val) => val && resetPageAnd(() => setStatusFilter(val))}>
          <SelectTrigger className="w-full sm:w-44 h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(val) => val && resetPageAnd(() => setTypeFilter(val))}>
          <SelectTrigger className="w-full sm:w-48 h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {NOTIFICATION_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="rounded-3xl">
          <CardContent className="py-14 text-center">
            <p className="text-sm text-slate-500">
              {search || statusFilter !== "all" || typeFilter !== "all"
                ? "No notifications match these filters."
                : "Nothing sent yet. Your broadcasts will show up here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((row) => {
            const status = STATUS_STYLES[row.status] ?? STATUS_STYLES.sent;
            return (
              <Card key={row.id} className="rounded-2xl overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {row.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.imageUrl}
                        alt=""
                        className="w-16 h-16 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-800"
                      />
                    )}

                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${status.className}`}
                        >
                          {status.label}
                        </span>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-primary/5 text-primary border-primary/10">
                          {row.type}
                        </span>
                        {row.resentFromId && (
                          <span className="text-[10px] font-semibold uppercase text-slate-400">Resend</span>
                        )}
                      </div>

                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {row.title || <span className="italic text-slate-400">No title</span>}
                      </p>
                      {row.body && <p className="text-xs text-slate-500 line-clamp-2">{row.body}</p>}

                      <p className="text-xs text-slate-500">
                        {TARGET_LABELS[row.targetMode]}
                        {row.targetMode === "users" && ` (${row.targetUserIds?.length ?? 0})`}
                        {" · "}
                        {row.status === "scheduled" ? (
                          <>Scheduled for {formatDateTime(row.scheduledAt)}</>
                        ) : (
                          <>
                            {formatRelative(row.sentAt ?? row.createdAt)}
                            {row.authorName ? ` by ${row.authorName}` : ""}
                          </>
                        )}
                      </p>

                      {row.status === "sent" && (
                        <p className="text-xs text-slate-500">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{row.sent}</span> push
                          {row.sent === 1 ? "" : "es"} delivered to {row.devices} device
                          {row.devices === 1 ? "" : "s"} across {row.recipients} user
                          {row.recipients === 1 ? "" : "s"}
                          {row.failed > 0 && <span className="text-red-500"> · {row.failed} failed</span>}
                        </p>
                      )}

                      {row.error && <p className="text-xs text-red-500 break-words">{row.error}</p>}
                    </div>

                    <div className="flex flex-col gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => setResendTarget(row)}
                        disabled={row.status === "scheduled" || row.status === "sending"}
                      >
                        <RefreshCw size={14} />
                        Resend
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5"
                        onClick={() => onDuplicate(broadcastToSeed(row))}
                      >
                        <Copy size={14} />
                        Duplicate
                      </Button>
                      {row.status === "scheduled" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5 text-amber-600 hover:text-amber-700"
                          disabled={cancelMutation.isPending}
                          onClick={() => cancelMutation.mutate(row.id)}
                        >
                          <Ban size={14} />
                          Cancel
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5 text-red-500 hover:text-red-600"
                          onClick={() => setDeleteTarget(row)}
                        >
                          <Trash2 size={14} />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + items.length} of {total}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 0 || isFetching}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <Button size="sm" variant="outline" disabled={!hasMore || isFetching} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      <ResendDialog broadcast={resendTarget} onClose={() => setResendTarget(null)} />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from history?</AlertDialogTitle>
            <AlertDialogDescription>
              This only deletes the record in this panel. Notifications already delivered stay on recipients&apos;
              devices and in their in-app inbox.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
