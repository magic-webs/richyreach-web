"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilLine, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  ComposeSeed,
  NOTIFICATION_TYPES,
  NotificationType,
  PushTemplate,
  apiJson,
  apiJsonBody,
  formatRelative,
  templateToSeed,
} from "./shared";

interface TemplatesTabProps {
  onUseTemplate: (seed: ComposeSeed) => void;
}

export function TemplatesTab({ onUseTemplate }: TemplatesTabProps) {
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState<PushTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PushTemplate | null>(null);
  const [draft, setDraft] = useState({ name: "", title: "", body: "", imageUrl: "", deepLink: "", type: "offer" });

  const { data: templates = [], isLoading } = useQuery<PushTemplate[]>({
    queryKey: ["pushTemplates"],
    queryFn: async () => (await apiJson<PushTemplate[]>("/admin/notifications/templates")).data,
  });

  const openEditor = (template: PushTemplate) => {
    setEditing(template);
    setDraft({
      name: template.name,
      title: template.title ?? "",
      body: template.body ?? "",
      imageUrl: template.imageUrl ?? "",
      deepLink: template.deepLink ?? "",
      type: template.type,
    });
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("Nothing to save");
      return apiJsonBody<PushTemplate>(`/admin/notifications/templates/${editing.id}`, "PUT", draft);
    },
    onSuccess: ({ message }) => {
      toast.success(message || "Template updated");
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["pushTemplates"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to update template"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiJsonBody(`/admin/notifications/templates/${id}`, "DELETE"),
    onSuccess: ({ message }) => {
      toast.success(message || "Template deleted");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["pushTemplates"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete template"),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {templates.length === 0 ? (
        <Card className="rounded-3xl">
          <CardContent className="py-14 text-center space-y-1">
            <p className="text-sm text-slate-500">No templates saved yet.</p>
            <p className="text-xs text-slate-400">
              Write a message in the Compose tab and use &ldquo;Save as template&rdquo; to keep it here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <Card key={template.id} className="rounded-2xl">
              <CardContent className="p-4 flex items-start gap-4">
                {template.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={template.imageUrl}
                    alt=""
                    className="w-14 h-14 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-800"
                  />
                )}

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{template.name}</p>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-primary/5 text-primary border-primary/10">
                      {template.type}
                    </span>
                  </div>
                  {template.title && <p className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate">{template.title}</p>}
                  {template.body && <p className="text-xs text-slate-500 line-clamp-2">{template.body}</p>}
                  <p className="text-[11px] text-slate-400">Updated {formatRelative(template.updatedAt)}</p>
                </div>

                <div className="flex flex-col gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => {
                      onUseTemplate(templateToSeed(template));
                      toast.success(`Loaded "${template.name}" into Compose`);
                    }}
                  >
                    <Send size={14} />
                    Use
                  </Button>
                  <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => openEditor(template)}>
                    <PencilLine size={14} />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-red-500 hover:text-red-600"
                    onClick={() => setDeleteTarget(template)}
                  >
                    <Trash2 size={14} />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit template</DialogTitle>
            <DialogDescription>Changes apply the next time you load this template.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tpl-name">Name</Label>
              <Input
                id="tpl-name"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                maxLength={60}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-title">Title</Label>
              <Input
                id="tpl-title"
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-body">Body</Label>
              <Textarea
                id="tpl-body"
                value={draft.body}
                onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                maxLength={200}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={draft.type}
                onValueChange={(val) => val && setDraft((d) => ({ ...d, type: val as NotificationType }))}
              >
                <SelectTrigger className="w-full h-9 text-sm">
                  <SelectValue />
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
              <Label htmlFor="tpl-image">Image URL</Label>
              <Input
                id="tpl-image"
                value={draft.imageUrl}
                onChange={(e) => setDraft((d) => ({ ...d, imageUrl: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-link">Deep link</Label>
              <Input
                id="tpl-link"
                value={draft.deepLink}
                onChange={(e) => setDraft((d) => ({ ...d, deepLink: e.target.value }))}
                placeholder="/collab/abc123"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              disabled={!draft.name.trim() || updateMutation.isPending}
              onClick={() => updateMutation.mutate()}
            >
              {updateMutation.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.name}&rdquo; will be removed. Notifications already sent from it are not affected.
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
