"use client";

import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookmarkPlus, CalendarClock, Send, TestTube2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUploadField } from "../../campaign-images/_components/ImageUploadField";
import { api } from "@/lib/api-client";
import { AudiencePicker } from "./AudiencePicker";
import { NotificationPreview } from "./NotificationPreview";
import {
  Broadcast,
  ComposeSeed,
  NOTIFICATION_IMAGE_WARN_BYTES,
  NOTIFICATION_TYPES,
  NotificationType,
  PushTemplate,
  TargetMode,
  apiJson,
  apiJsonBody,
  buildTarget,
  localInputToIso,
  templateToSeed,
} from "./shared";

interface ComposeTabProps {
  /** Set when the user pressed Duplicate on a history row or loaded a template. */
  seed: ComposeSeed | null;
  onSeedConsumed: () => void;
}

export function ComposeTab({ seed, onSeedConsumed }: ComposeTabProps) {
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [deepLink, setDeepLink] = useState("");
  const [notificationType, setNotificationType] = useState<NotificationType>("offer");
  const [targetMode, setTargetMode] = useState<TargetMode>("all");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [templateName, setTemplateName] = useState("");

  const resetForm = () => {
    setTitle("");
    setBody("");
    setImageUrl("");
    setImageFile(null);
    setDeepLink("");
    setNotificationType("offer");
    setTargetMode("all");
    setSelectedUserIds([]);
    setUserSearch("");
    setScheduleAt("");
    setTemplateName("");
  };

  const applySeed = (next: ComposeSeed) => {
    setTitle(next.title);
    setBody(next.body);
    setImageUrl(next.imageUrl);
    setImageFile(null);
    setDeepLink(next.deepLink);
    setNotificationType(next.type);
    if (next.targetMode) setTargetMode(next.targetMode);
    setSelectedUserIds(next.targetUserIds ?? []);
    // Never carried over: a duplicate of a scheduled send should not silently re-schedule.
    setScheduleAt("");
  };

  useEffect(() => {
    if (!seed) return;
    applySeed(seed);
    onSeedConsumed();
  }, [seed, onSeedConsumed]);

  const { data: templates = [] } = useQuery<PushTemplate[]>({
    queryKey: ["pushTemplates"],
    queryFn: async () => (await apiJson<PushTemplate[]>("/admin/notifications/templates")).data,
  });

  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api("/media/upload", { method: "POST", body: formData });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !(json as any).success) {
        throw new Error((json as any).error || "Failed to upload image");
      }
      return (json as any).data.url as string;
    },
    onSuccess: (url) => setImageUrl(url),
    onError: (err: any) => {
      toast.error(err.message || "Failed to upload image");
      setImageFile(null);
    },
  });

  const messagePayload = () => ({
    title: title.trim() || undefined,
    body: body.trim() || undefined,
    imageUrl: imageUrl.trim() || undefined,
    deepLink: deepLink.trim() || undefined,
    type: notificationType,
  });

  const sendMutation = useMutation({
    mutationFn: async () =>
      apiJsonBody<Broadcast>("/admin/notifications/broadcast", "POST", {
        ...messagePayload(),
        target: buildTarget(targetMode, selectedUserIds),
        scheduledAt: localInputToIso(scheduleAt),
      }),
    onSuccess: ({ data, message }) => {
      // The backend sends before responding and reports what reached a device, so show that
      // instead of a "queued" message that was true even when nothing landed.
      if (data.status === "scheduled") {
        toast.success(message || "Notification scheduled");
      } else if (data.status === "failed") {
        toast.error(message || "The notification failed to send");
      } else if (data.sent === 0) {
        toast.warning(message || "Saved to the in-app inbox, but no device received a push.");
      } else {
        toast.success(message || "Notification sent");
      }
      queryClient.invalidateQueries({ queryKey: ["pushBroadcasts"] });
      resetForm();
    },
    onError: (err: any) => toast.error(err.message || "Failed to send notification"),
  });

  const testMutation = useMutation({
    mutationFn: async () => apiJsonBody("/admin/notifications/test", "POST", messagePayload()),
    onSuccess: ({ message }) => toast.success(message || "Test sent to your devices"),
    onError: (err: any) => toast.error(err.message || "Failed to send test"),
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async () =>
      apiJsonBody<PushTemplate>("/admin/notifications/templates", "POST", {
        ...messagePayload(),
        name: templateName.trim(),
      }),
    onSuccess: ({ message }) => {
      toast.success(message || "Template saved");
      setTemplateName("");
      queryClient.invalidateQueries({ queryKey: ["pushTemplates"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to save template"),
  });

  const hasContent = Boolean(title.trim() || body.trim() || imageUrl.trim());

  const validate = (): boolean => {
    if (!hasContent) {
      toast.error("Provide at least a title, body, or image");
      return false;
    }
    if (targetMode === "users" && selectedUserIds.length === 0) {
      toast.error("Select at least one user to notify");
      return false;
    }
    if (scheduleAt) {
      const iso = localInputToIso(scheduleAt);
      if (!iso) {
        toast.error("That schedule date could not be read");
        return false;
      }
      if (new Date(iso).getTime() <= Date.now()) {
        toast.error("Pick a time in the future, or clear the field to send now");
        return false;
      }
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    sendMutation.mutate();
  };

  const busy = sendMutation.isPending || uploadImageMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle>Message</CardTitle>
          <CardDescription>This is what recipients will see on their device.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {templates.length > 0 && (
            <div className="space-y-2">
              <Label>Start from a template</Label>
              <Select
                value=""
                onValueChange={(val) => {
                  const template = templates.find((t) => t.id === val);
                  if (!template) return;
                  applySeed(templateToSeed(template));
                  toast.success(`Loaded "${template.name}"`);
                }}
              >
                <SelectTrigger className="w-full h-9 text-sm">
                  <SelectValue placeholder="Choose a saved template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notif-title">Title (optional if an image is attached)</Label>
            <Input
              id="notif-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. New Year Offer! 🎉"
              maxLength={80}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notif-body">Body (optional if an image is attached)</Label>
            <Textarea
              id="notif-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write the notification message..."
              maxLength={200}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Notification type</Label>
            <Select
              value={notificationType}
              onValueChange={(val) => val && setNotificationType(val as NotificationType)}
            >
              <SelectTrigger className="w-full h-9 text-sm">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {NOTIFICATION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Image (optional)</Label>
            <ImageUploadField
              file={imageFile}
              url={imageUrl}
              onFileChange={(file) => {
                setImageFile(file);
                if (!file) return;
                // Android decodes the image into a notification bitmap and drops it when
                // it is too heavy, so a multi-megabyte upload silently loses the picture.
                if (file.size > NOTIFICATION_IMAGE_WARN_BYTES) {
                  toast.warning(
                    `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. Notification images over 1 MB often fail to render on Android — resize it to roughly 1024x512 first.`
                  );
                }
                uploadImageMutation.mutate(file);
              }}
              onUrlChange={setImageUrl}
              fileLabel="Upload Image"
              urlLabel="Or paste an Image URL"
            />
            {uploadImageMutation.isPending && <p className="text-xs text-slate-500">Uploading image...</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notif-link">Deep link (optional)</Label>
            <Input
              id="notif-link"
              value={deepLink}
              onChange={(e) => setDeepLink(e.target.value)}
              placeholder="/collab/abc123"
            />
          </div>

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

          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800/60">
            <Label htmlFor="notif-schedule" className="flex items-center gap-1.5">
              <CalendarClock size={14} />
              Schedule (optional)
            </Label>
            <div className="flex gap-2">
              <Input
                id="notif-schedule"
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
            <p className="text-xs text-slate-500">
              {scheduleAt
                ? "The push goes out at this time, accurate to the minute. It stays cancellable from History until then."
                : "Leave empty to send immediately."}
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex-col sm:flex-row gap-3 sm:justify-between items-stretch sm:items-center">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={!hasContent || testMutation.isPending}
            onClick={() => {
              if (!hasContent) {
                toast.error("Provide at least a title, body, or image");
                return;
              }
              testMutation.mutate();
            }}
          >
            <TestTube2 size={16} />
            {testMutation.isPending ? "Sending..." : "Send test to me"}
          </Button>

          <Button type="submit" disabled={busy} className="gap-2">
            <Send size={16} />
            {sendMutation.isPending
              ? scheduleAt
                ? "Scheduling..."
                : "Sending..."
              : scheduleAt
                ? "Schedule Notification"
                : "Send Notification"}
          </Button>
        </CardFooter>
      </Card>

      <div className="space-y-6 lg:sticky lg:top-6">
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
            <CardDescription>How this lands on a phone.</CardDescription>
          </CardHeader>
          <CardContent>
            <NotificationPreview title={title} body={body} imageUrl={imageUrl} />
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Save as template</CardTitle>
            <CardDescription>Reuse this message later without retyping it.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name"
              maxLength={60}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              disabled={!templateName.trim() || !hasContent || saveTemplateMutation.isPending}
              onClick={() => saveTemplateMutation.mutate()}
            >
              <BookmarkPlus size={16} />
              {saveTemplateMutation.isPending ? "Saving..." : "Save template"}
            </Button>
            {!hasContent && (
              <p className="text-xs text-slate-500">Add a title, body or image before saving a template.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
