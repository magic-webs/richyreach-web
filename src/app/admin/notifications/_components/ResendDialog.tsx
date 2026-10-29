"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AudiencePicker } from "./AudiencePicker";
import { NotificationPreview } from "./NotificationPreview";
import {
  Broadcast,
  TARGET_LABELS,
  TargetMode,
  apiJsonBody,
  buildTarget,
  localInputToIso,
} from "./shared";

interface ResendDialogProps {
  broadcast: Broadcast | null;
  onClose: () => void;
}

/**
 * Confirms a resend, with the chance to redirect it at a different audience first.
 *
 * The message itself is deliberately read-only — editing it here would make the history
 * misleading, since the new row would claim to be a resend of something it no longer
 * matches. Editing goes through Duplicate, which opens the compose form instead.
 */
export function ResendDialog({ broadcast, onClose }: ResendDialogProps) {
  const queryClient = useQueryClient();

  const [changeAudience, setChangeAudience] = useState(false);
  const [targetMode, setTargetMode] = useState<TargetMode>("all");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");

  // Reset every time a different row is opened, so nothing leaks between dialogs.
  const [lastId, setLastId] = useState<string | null>(null);
  if (broadcast && broadcast.id !== lastId) {
    setLastId(broadcast.id);
    setChangeAudience(false);
    setTargetMode(broadcast.targetMode);
    setSelectedUserIds(broadcast.targetUserIds ?? []);
    setUserSearch("");
    setScheduleAt("");
  }

  const resendMutation = useMutation({
    mutationFn: async () => {
      if (!broadcast) throw new Error("Nothing to resend");
      return apiJsonBody<Broadcast>(`/admin/notifications/broadcasts/${broadcast.id}/resend`, "POST", {
        target: changeAudience ? buildTarget(targetMode, selectedUserIds) : undefined,
        scheduledAt: localInputToIso(scheduleAt),
      });
    },
    onSuccess: ({ data, message }) => {
      if (data.status === "scheduled") {
        toast.success(message || "Resend scheduled");
      } else if (data.status === "failed") {
        toast.error(message || "The resend failed");
      } else if (data.sent === 0) {
        toast.warning(message || "Saved to the in-app inbox, but no device received a push.");
      } else {
        toast.success(message || "Notification resent");
      }
      queryClient.invalidateQueries({ queryKey: ["pushBroadcasts"] });
      onClose();
    },
    onError: (err: any) => toast.error(err.message || "Failed to resend"),
  });

  const handleResend = () => {
    if (changeAudience && targetMode === "users" && selectedUserIds.length === 0) {
      toast.error("Select at least one user to notify");
      return;
    }
    if (scheduleAt) {
      const iso = localInputToIso(scheduleAt);
      if (!iso || new Date(iso).getTime() <= Date.now()) {
        toast.error("Pick a time in the future, or clear the field to send now");
        return;
      }
    }
    resendMutation.mutate();
  };

  return (
    <Dialog open={Boolean(broadcast)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Resend notification</DialogTitle>
          <DialogDescription>
            This sends the same message again and records it as a new entry in the history.
          </DialogDescription>
        </DialogHeader>

        {broadcast && (
          <div className="space-y-5">
            <NotificationPreview
              title={broadcast.title ?? ""}
              body={broadcast.body ?? ""}
              imageUrl={broadcast.imageUrl ?? ""}
            />

            <div className="rounded-xl border border-slate-200 dark:border-slate-800/60 p-3 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Audience</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {TARGET_LABELS[broadcast.targetMode]}
                    {broadcast.targetMode === "users" && ` (${broadcast.targetUserIds?.length ?? 0})`}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setChangeAudience((p) => !p)}>
                  {changeAudience ? "Keep original" : "Change"}
                </Button>
              </div>

              {changeAudience && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800/60">
                  <AudiencePicker
                    mode={targetMode}
                    onModeChange={setTargetMode}
                    selectedUserIds={selectedUserIds}
                    onSelectedUserIdsChange={setSelectedUserIds}
                    search={userSearch}
                    onSearchChange={setUserSearch}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="resend-schedule">Schedule (optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="resend-schedule"
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                  className="flex-1"
                />
                {scheduleAt && (
                  <Button type="button" variant="outline" onClick={() => setScheduleAt("")}>
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-xs text-slate-500">Leave empty to send it right away.</p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" className="gap-2" disabled={resendMutation.isPending} onClick={handleResend}>
            <RefreshCw size={16} />
            {resendMutation.isPending ? "Sending..." : scheduleAt ? "Schedule resend" : "Resend now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
