"use client";

import React, { useState } from "react";
import { ChevronDown, Smartphone } from "lucide-react";

interface NotificationPreviewProps {
  title: string;
  body: string;
  imageUrl: string;
}

/**
 * Approximates how the push renders on a device.
 *
 * Android is the interesting case: collapsed, the image is a small square thumbnail on the
 * right; expanded, it becomes the full-width picture. That mirrors the BigPictureStyle
 * behaviour patched into expo-notifications, and it is the reason the collapsed/expanded
 * toggle exists here at all — the two layouts crop the image very differently and an admin
 * needs to see both before sending.
 *
 * iOS shows no image: the app ships no Notification Service Extension, so a rich payload
 * arrives as plain text there.
 */
export function NotificationPreview({ title, body, imageUrl }: NotificationPreviewProps) {
  const [platform, setPlatform] = useState<"android" | "ios">("android");
  const [expanded, setExpanded] = useState(true);

  // Matches the backend's own fallback: an image-only push still needs a line of text.
  const shownTitle = title.trim() || (body.trim() ? "" : "RichyReach");
  const shownBody = body.trim();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-900 p-1">
          {(["android", "ios"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setPlatform(value)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                platform === value
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {value === "android" ? "Android" : "iOS"}
            </button>
          ))}
        </div>

        {platform === "android" && imageUrl && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-primary transition-colors"
          >
            <ChevronDown size={14} className={expanded ? "rotate-180 transition-transform" : "transition-transform"} />
            {expanded ? "Collapsed view" : "Expanded view"}
          </button>
        )}
      </div>

      {/* Notification shade */}
      <div className="rounded-2xl bg-slate-900 dark:bg-black p-3 border border-slate-800">
        <div className="rounded-xl bg-slate-800/90 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
            <div className="w-3.5 h-3.5 rounded-full bg-primary shrink-0" />
            <span className="text-[11px] font-medium text-slate-300">RichyReach</span>
            <span className="text-[11px] text-slate-500">• now</span>
          </div>

          <div className="flex items-start gap-3 px-3 pb-3">
            <div className="min-w-0 flex-1">
              {shownTitle && (
                <p className="text-sm font-semibold text-white leading-snug break-words">{shownTitle}</p>
              )}
              {shownBody ? (
                <p className={`text-xs text-slate-300 leading-relaxed break-words ${expanded ? "" : "line-clamp-2"}`}>
                  {shownBody}
                </p>
              ) : (
                <p className="text-xs italic text-slate-500">No body text</p>
              )}
            </div>

            {/* Collapsed Android keeps the image as a thumbnail; iOS never shows one. */}
            {imageUrl && platform === "android" && !expanded && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt=""
                className="w-11 h-11 rounded-md object-cover shrink-0 border border-slate-700"
              />
            )}
          </div>

          {imageUrl && platform === "android" && expanded && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="w-full max-h-56 object-cover border-t border-slate-700" />
          )}
        </div>
      </div>

      <p className="text-[11px] text-slate-500 flex items-start gap-1.5 leading-relaxed">
        <Smartphone size={13} className="mt-0.5 shrink-0" />
        {platform === "android" ? (
          <span>
            Android shows the thumbnail collapsed and the full picture when expanded. A 2:1 image around 1024×512
            renders best.
          </span>
        ) : (
          <span>
            iOS shows title and body only — the app has no Notification Service Extension, so the image is not
            downloaded there.
          </span>
        )}
      </p>
    </div>
  );
}
