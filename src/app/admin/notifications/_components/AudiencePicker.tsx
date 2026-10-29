"use client";

import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AdminUser,
  AudienceReach,
  TARGET_OPTIONS,
  TargetMode,
  apiJson,
  apiJsonBody,
  buildTarget,
} from "./shared";

interface AudiencePickerProps {
  mode: TargetMode;
  onModeChange: (mode: TargetMode) => void;
  selectedUserIds: string[];
  onSelectedUserIdsChange: (ids: string[]) => void;
  search: string;
  onSearchChange: (value: string) => void;
  /** Hidden in the resend dialog, where vertical space is tight. */
  showReach?: boolean;
}

export function AudiencePicker({
  mode,
  onModeChange,
  selectedUserIds,
  onSelectedUserIdsChange,
  search,
  onSearchChange,
  showReach = true,
}: AudiencePickerProps) {
  const { data: users = [], isLoading: usersLoading } = useQuery<AdminUser[]>({
    queryKey: ["adminUsersForNotifications"],
    queryFn: async () => (await apiJson<AdminUser[]>("/admin/users")).data,
    enabled: mode === "users",
  });

  // Only asked for once the selection is non-empty: a "specific users" target with nothing
  // picked resolves to zero on the server and the request would be pure noise.
  const reachEnabled = showReach && (mode !== "users" || selectedUserIds.length > 0);

  const { data: reach, isFetching: reachLoading } = useQuery<AudienceReach>({
    queryKey: ["notificationAudienceReach", mode, mode === "users" ? selectedUserIds : null],
    queryFn: async () =>
      (
        await apiJsonBody<AudienceReach>("/admin/notifications/audience", "POST", {
          target: buildTarget(mode, selectedUserIds),
        })
      ).data,
    enabled: reachEnabled,
    staleTime: 30_000,
  });

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, search]);

  const toggleUser = (id: string) => {
    onSelectedUserIdsChange(
      selectedUserIds.includes(id) ? selectedUserIds.filter((x) => x !== id) : [...selectedUserIds, id]
    );
  };

  const allFilteredSelected =
    filteredUsers.length > 0 && filteredUsers.every((u) => selectedUserIds.includes(u.id));

  const toggleAllFiltered = () => {
    if (allFilteredSelected) {
      const filteredIds = new Set(filteredUsers.map((u) => u.id));
      onSelectedUserIdsChange(selectedUserIds.filter((id) => !filteredIds.has(id)));
    } else {
      onSelectedUserIdsChange([...new Set([...selectedUserIds, ...filteredUsers.map((u) => u.id)])]);
    }
  };

  return (
    <div className="space-y-3">
      <Label>Send to</Label>
      <RadioGroup
        value={mode}
        onValueChange={(val) => val && onModeChange(val as TargetMode)}
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        {TARGET_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800/60 cursor-pointer hover:border-primary/50 transition-colors"
          >
            <RadioGroupItem value={opt.value} />
            <span className="text-sm font-medium">{opt.label}</span>
          </label>
        ))}
      </RadioGroup>

      {mode === "users" && (
        <div className="mt-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by name or email..."
              className="pl-9"
            />
          </div>

          <div className="border border-slate-200 dark:border-slate-800/60 rounded-xl max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-900">
            {usersLoading ? (
              <div className="p-4 space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">No users found.</div>
            ) : (
              <>
                <label className="flex items-center gap-3 p-3 cursor-pointer bg-slate-50/80 dark:bg-slate-900/40 sticky top-0 backdrop-blur-sm">
                  <Checkbox checked={allFilteredSelected} onCheckedChange={toggleAllFiltered} />
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {allFilteredSelected ? "Clear" : "Select"} all {filteredUsers.length} shown
                  </span>
                </label>
                {filteredUsers.map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                  >
                    <Checkbox checked={selectedUserIds.includes(u.id)} onCheckedChange={() => toggleUser(u.id)} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {u.name || "Unnamed"}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{u.email}</p>
                    </div>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full border bg-primary/5 text-primary border-primary/10 shrink-0">
                      {u.role}
                    </span>
                  </label>
                ))}
              </>
            )}
          </div>

          <p className="text-xs text-slate-500">{selectedUserIds.length} selected</p>
        </div>
      )}

      {showReach && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800/60 bg-slate-50/60 dark:bg-slate-900/30 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
            <Users size={13} />
            Audience reach
          </div>

          {!reachEnabled ? (
            <p className="text-xs text-slate-500">Pick at least one user to see how many can be reached.</p>
          ) : reachLoading && !reach ? (
            <Skeleton className="h-8 w-full" />
          ) : reach ? (
            <div className="space-y-1.5">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                <span className="font-bold text-slate-900 dark:text-white">{reach.reachable}</span> of{" "}
                <span className="font-bold text-slate-900 dark:text-white">{reach.users}</span> targeted user
                {reach.users === 1 ? "" : "s"} can receive a push.
              </p>
              <p className="text-xs text-slate-500">
                {reach.android} on Android · {reach.ios} on iOS
                {reach.web > 0 ? ` · ${reach.web} on web` : ""}
              </p>
              {reach.users > 0 && reach.reachable === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Nobody in this audience has the app installed with notifications enabled — they will only get the
                  in-app inbox entry.
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Could not estimate the audience.</p>
          )}
        </div>
      )}
    </div>
  );
}
