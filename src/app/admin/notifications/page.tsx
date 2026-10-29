"use client";

import React, { useCallback, useState } from "react";
import { useAuth } from "../../layout-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ComposeTab } from "./_components/ComposeTab";
import { HistoryTab } from "./_components/HistoryTab";
import { TemplatesTab } from "./_components/TemplatesTab";
import { ComposeSeed } from "./_components/shared";

const TAB_CLASS =
  "flex-1 rounded-lg text-sm font-semibold px-6 py-2.5 hover:text-primary data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm";

export default function AdminNotificationsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("compose");

  /**
   * Message handed over from History ("Duplicate") or Templates ("Use").
   *
   * Held here rather than inside ComposeTab because the sending tab is the one that knows a
   * handover happened; ComposeTab clears it once applied so re-selecting the tab later does
   * not silently overwrite whatever the admin has typed since.
   */
  const [composeSeed, setComposeSeed] = useState<ComposeSeed | null>(null);

  const handleSeed = useCallback((seed: ComposeSeed) => {
    setComposeSeed(seed);
    setTab("compose");
  }, []);

  const clearSeed = useCallback(() => setComposeSeed(null), []);

  if (user.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-slate-500">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-10">
      <div>
        <h1 className="text-sm font-medium text-primary">Push Notifications</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Broadcast an announcement, offer, or update to influencers and brands — then resend, schedule, or reuse it
          from here.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-1.5 rounded-xl inline-flex w-full overflow-x-auto">
          <TabsTrigger value="compose" className={TAB_CLASS}>
            Compose
          </TabsTrigger>
          <TabsTrigger value="history" className={TAB_CLASS}>
            History
          </TabsTrigger>
          <TabsTrigger value="templates" className={TAB_CLASS}>
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="animate-fade-in">
          <ComposeTab seed={composeSeed} onSeedConsumed={clearSeed} />
        </TabsContent>

        <TabsContent value="history" className="animate-fade-in">
          <HistoryTab onDuplicate={handleSeed} />
        </TabsContent>

        <TabsContent value="templates" className="animate-fade-in">
          <TemplatesTab onUseTemplate={handleSeed} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
