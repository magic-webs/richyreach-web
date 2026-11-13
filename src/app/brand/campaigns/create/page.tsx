"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../../../layout-shell";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";

export default function CreateCampaignPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingBrief, setGeneratingBrief] = useState(false);

  const [brandAccounts, setBrandAccounts] = useState<any[]>([]);
  const [selectedBrandAccountId, setSelectedBrandAccountId] = useState<string>("");

  // Raw user inputs
  const [title, setTitle] = useState("");
  const [budgetInr, setBudgetInr] = useState("1000");
  const [campaignType, setCampaignType] = useState("reel");
  const [influencerTier, setInfluencerTier] = useState<string>("mid");
  const [targetAudience, setTargetAudience] = useState("");
  const [requirements, setRequirements] = useState("");
  const [allowFraction, setAllowFraction] = useState(false);
  const [isArena, setIsArena] = useState(false);
  const [maxReachCap, setMaxReachCap] = useState("100000");

  const [arenaTemplates, setArenaTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedBannerUrl, setSelectedBannerUrl] = useState("");
  const [category, setCategory] = useState("General");

  // AI generated and editable fields
  const [aiTitle, setAiTitle] = useState("");
  const [aiDescription, setAiDescription] = useState("");
  const [aiTargetAudience, setAiTargetAudience] = useState("");
  const [aiRequirements, setAiRequirements] = useState("");

  useEffect(() => {
    const loadTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const res = await api("/arena/templates");
        if (res.ok) {
          const json = (await res.json()) as any;
          if (json.success) {
            setArenaTemplates(json.data || []);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingTemplates(false);
      }
    };
    if (user.role === "brand") loadTemplates();
  }, [user.role]);

  useEffect(() => {
    const loadBrandAccounts = async () => {
      setLoadingAccounts(true);
      try {
        const res = await api("/brands/accounts");
        const json = (await res.json()) as any;
        if (json.success) {
          const verified = (json.data || []).filter((a: any) => a.status === "verified");
          setBrandAccounts(verified);
          if (verified.length > 0) {
            setSelectedBrandAccountId(verified[0].id);
            setStep(2);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingAccounts(false);
      }
    };
    if (user.role === "brand") loadBrandAccounts();
  }, [user.role]);

  const handleGenerateBrief = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !budgetInr || !selectedBrandAccountId) return;

    setGeneratingBrief(true);

    try {
      const selectedBrand = brandAccounts.find(a => a.id === selectedBrandAccountId);

      let finalRequirements = requirements;
      if (isArena) {
        finalRequirements += `\n\n**Arena Contest Rules:**\n- All posts must include 3 collabs to be eligible: Brand + RR + Influencer.\n- Maximum account reach capping for payout is ${maxReachCap}.`;
      }

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            title,
            budget: budgetInr,
            format: campaignType,
            tier: influencerTier,
            targetAudience,
            baseRequirements: finalRequirements,
            allowFraction,
            brandName: selectedBrand?.companyName
          }
        })
      });

      const result = (await res.json()) as any;

      if (res.ok && result.brief) {
        setAiTitle(result.brief.refinedTitle || title);
        setAiDescription(result.brief.description || "");
        setAiTargetAudience(result.brief.targetAudience || targetAudience);
        setAiRequirements(result.brief.requirements || requirements);
        setStep(3);
      } else {
        alert("Failed to generate brief: " + (result.error || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
      alert("Error generating brief.");
    } finally {
      setGeneratingBrief(false);
    }
  };

  const handlePublish = async () => {
    if (!aiTitle || !aiDescription || !budgetInr || !selectedBrandAccountId) {
      alert("Please ensure the title and description are not empty.");
      return;
    }
    if (isArena && !selectedBannerUrl) {
      alert("Please select a banner image template for the Arena Contest.");
      return;
    }
    try {
      setSaving(true);
      const budgetCents = Math.round(parseFloat(budgetInr) * 100) || 0;

      let res;
      if (isArena) {
        res = await api("/arena/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-active-profile-id": selectedBrandAccountId
          },
          body: JSON.stringify({
            title: aiTitle,
            description: aiDescription,
            arenaType: "reel_reach",
            entryFeeCoins: 0,
            totalBudgetCoins: budgetCents,
            maxParticipants: 100,
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            category,
            bannerUrl: selectedBannerUrl,
            reviewGuidelines: aiRequirements || null,
            verificationRules: { minRating: 4 }
          }),
        });
      } else {
        res = await api("/campaigns/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-active-profile-id": selectedBrandAccountId
          },
          body: JSON.stringify({
            title: aiTitle,
            description: aiDescription,
            targetAudience: aiTargetAudience || null,
            requirements: aiRequirements || null,
            budget: budgetCents,
            campaignType,
            expectedReach: 150000,
            brandAccountId: selectedBrandAccountId,
            allowFraction,
            category,
          }),
        });
      }

      if (res.ok) {
        const result = (await res.json()) as any;
        if (result.success) {
          alert(isArena ? "Arena Contest launched successfully!" : "Campaign launched successfully!");
          router.push("/brand/dashboard");
        } else {
          alert("Error: " + JSON.stringify(result.error));
        }
      } else {
        const errorText = await res.text();
        alert("Failed: " + errorText);
      }
    } catch (error) {
      console.error(error);
      alert("An unexpected error occurred during creation.");
    } finally {
      setSaving(false);
    }
  };

  if (user.role !== "brand") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/80 rounded-3xl backdrop-blur-md">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-300 mb-2">Access Restricted</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6">Only Brand accounts can create and launch campaigns.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
      <div>
        <Link href="/brand/dashboard" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors font-bold uppercase">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Workspace
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-4 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60 dark:from-primary dark:to-primary/50">
          Campaign Builder
        </h1>
        <p className="text-primary/80 dark:text-primary/60 text-sm mt-1">
          Generate a campaign brief in seconds, then tweak to perfection.
        </p>
      </div>

      <div className="flex items-center gap-2 mb-8">
        {[2, 3].map((s) => (
          <div key={s} className={`h-1.5 rounded-full flex-1 transition-all duration-500 ${step >= s ? "bg-primary shadow-sm shadow-primary/30 dark:shadow-primary/50" : "bg-slate-200 dark:bg-slate-800"}`} />
        ))}
      </div>

      {step === 1 && !loadingAccounts && brandAccounts.length === 0 && (
        <Card className="bg-white/90 dark:bg-slate-900/60 border-destructive/20 dark:border-destructive/30 backdrop-blur-xl shadow-2xl">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-4">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center text-destructive mb-2">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Verified Profile Required</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-md">
              You must have at least one **verified Brand Profile** before launching a campaign. This ensures creators know exactly who they are working with.
            </p>
            <Link href="/brand/profile" className="mt-4 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-lg transition-colors inline-block">
              Add Brand Profile →
            </Link>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="bg-white/80 dark:bg-slate-900/40 border-primary/20 dark:border-primary/20 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 dark:bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
          <CardHeader>
            <CardTitle className="text-xl text-slate-900 dark:text-white">Campaign Foundation</CardTitle>
            <CardDescription className="text-primary/70 dark:text-primary/50">Draft the basics, and format the perfect brief.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleGenerateBrief} className="space-y-6 relative z-10">

              <div className="space-y-2">
                <Label className="text-primary/80 dark:text-primary/80 text-xs font-bold uppercase tracking-wider">Posting As</Label>
                <Select value={selectedBrandAccountId} onValueChange={(val) => val && setSelectedBrandAccountId(val as string)} required>
                  <SelectTrigger className="bg-white dark:bg-slate-950/50 border-slate-200 dark:border-slate-700/50 text-slate-900 dark:text-white rounded-xl h-12">
                    <SelectValue placeholder="Select Brand Profile">
                      {brandAccounts.find((a: any) => a.id === selectedBrandAccountId) ? (
                        <span className="flex items-center gap-2 font-medium">
                          {brandAccounts.find((a: any) => a.id === selectedBrandAccountId).companyName}
                        </span>
                      ) : "Select Brand Profile"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-300">
                    {brandAccounts.map((acc: any) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        <span className="flex items-center gap-2 font-medium pr-6">
                          {acc.companyName}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-primary/80 dark:text-primary/80 text-xs font-bold uppercase tracking-wider">Campaign Category</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div
                    onClick={() => setIsArena(false)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${!isArena ? 'border-primary bg-primary/5 shadow-sm' : 'border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-950/50'}`}
                  >
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Standard Campaign</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Normal influencer collaboration.</p>
                  </div>
                  <div
                    onClick={() => setIsArena(true)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${isArena ? 'border-primary bg-primary/5 shadow-sm' : 'border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-950/50'}`}
                  >
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Arena Contest</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Performance-based rewards for reach.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-primary/80 dark:text-primary/80 text-xs font-bold uppercase tracking-wider">Niche / Category</Label>
                <Select value={category} onValueChange={(val) => {
                  if (val) {
                    setCategory(val);
                    setSelectedBannerUrl("");
                  }
                }}>
                  <SelectTrigger className="bg-white dark:bg-slate-950/50 border-slate-200 dark:border-slate-700/50 text-slate-900 dark:text-white rounded-xl h-12">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-350">
                    {["General", "Fashion", "Beauty", "Tech", "Food", "Travel", "Fitness", "Lifestyle", "Gaming", "Education"].map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isArena && (
                <div className="space-y-4">
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-4">
                    <div className="space-y-2">
                      <Label className="text-primary/80 dark:text-primary/80 text-xs font-bold uppercase tracking-wider">Max Reach Capping</Label>
                      <Input type="number" min="1000" value={maxReachCap} onChange={(e) => setMaxReachCap(e.target.value)} className="bg-white dark:bg-slate-950/50 border-slate-200 dark:border-slate-700/50 text-slate-900 dark:text-white rounded-xl h-12 focus:border-primary" required />
                      <p className="text-xs text-slate-500 dark:text-slate-400">Coins will be paid for account reach (100 coins = 1 Rs). This sets a limit on maximum payout.</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-primary/80 dark:text-primary/80 text-xs font-bold uppercase tracking-wider">Select Arena Banner *</Label>
                    {loadingTemplates ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} className="aspect-video bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                        ))}
                      </div>
                    ) : (() => {
                      const filtered = arenaTemplates.filter(t => t.category?.toLowerCase() === category.toLowerCase());
                      const templatesToShow = filtered.length > 0
                        ? filtered
                        : arenaTemplates.filter(t => t.category?.toLowerCase() === 'general').length > 0
                          ? arenaTemplates.filter(t => t.category?.toLowerCase() === 'general')
                          : arenaTemplates;

                      if (templatesToShow.length === 0) {
                        return (
                          <div className="text-xs text-slate-500 py-4">No banner templates available. Configure them in Admin section first.</div>
                        );
                      }

                      return (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {templatesToShow.map(tmpl => {
                            const active = selectedBannerUrl === tmpl.imageUrl;
                            return (
                              <div
                                key={tmpl.id}
                                onClick={() => setSelectedBannerUrl(tmpl.imageUrl)}
                                className={`group relative aspect-video rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                                  active ? "border-primary ring-2 ring-primary/20 scale-[0.98]" : "border-slate-200 dark:border-slate-800 hover:border-primary/50"
                                }`}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={tmpl.imageUrl} alt="Template" className="w-full h-full object-cover" />
                                {active && (
                                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                    <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shadow-md">✓</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-primary/80 dark:text-primary/80 text-xs font-bold uppercase tracking-wider">Campaign Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Neon Summer Collection Launch" className="bg-white dark:bg-slate-950/50 border-slate-200 dark:border-slate-700/50 text-slate-900 dark:text-white rounded-xl h-12 focus:border-primary focus:ring-1 focus:ring-primary/30" required />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-primary/80 dark:text-primary/80 text-xs font-bold uppercase tracking-wider">Total Budget (INR)</Label>
                  <div className="relative flex items-center">
                    <span className="absolute left-4 text-slate-500 dark:text-slate-400 font-bold">₹</span>
                    <Input type="number" min="100" value={budgetInr} onChange={(e) => setBudgetInr(e.target.value)} className="pl-8 bg-white dark:bg-slate-950/50 border-slate-200 dark:border-slate-700/50 text-slate-900 dark:text-white rounded-xl h-12 focus:border-primary" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-primary/80 dark:text-primary/80 text-xs font-bold uppercase tracking-wider">Content Format</Label>
                  <Select value={campaignType} onValueChange={(val) => val && setCampaignType(val)}>
                    <SelectTrigger className="bg-white dark:bg-slate-950/50 border-slate-200 dark:border-slate-700/50 text-slate-900 dark:text-white rounded-xl h-12">
                      <SelectValue placeholder="Select Type" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-300">
                      <SelectItem value="reel">Instagram Reel</SelectItem>
                      <SelectItem value="story">Instagram Story</SelectItem>
                      <SelectItem value="post">Instagram Image Post</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950/40 border border-primary/20 dark:border-primary/20 rounded-xl">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Allow Fractional Creators</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Allow multiple creators to apply and split the budget.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={allowFraction} onChange={(e) => setAllowFraction(e.target.checked)} />
                  <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary dark:peer-checked:bg-primary shadow-inner"></div>
                </label>
              </div>

              <div className="space-y-2">
                <Label className="text-primary/80 dark:text-primary/80 text-xs font-bold uppercase tracking-wider">Target Audience (Optional)</Label>
                <Input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} placeholder="e.g. Gen Z, Fashion enthusiasts, US based" className="bg-white dark:bg-slate-950/50 border-slate-200 dark:border-slate-700/50 text-slate-900 dark:text-white rounded-xl h-12 focus:border-primary" />
              </div>

              <div className="space-y-2">
                <Label className="text-primary/80 dark:text-primary/80 text-xs font-bold uppercase tracking-wider">Raw Requirements / Brain dump</Label>
                <textarea rows={3} value={requirements} onChange={(e) => setRequirements(e.target.value)} placeholder="Just braindump what you need. It will be formatted into a professional brief..." className="w-full p-4 text-sm bg-white dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700/50 text-slate-900 dark:text-white rounded-xl focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none placeholder-slate-400 dark:placeholder-slate-500 resize-none" />
              </div>

              <button type="submit" disabled={generatingBrief} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-4 rounded-xl shadow-sm shadow-primary/20 dark:shadow-primary/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                {generatingBrief ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Polishing Brief...
                  </>
                ) : (
                  "Generate Brief ✨"
                )}
              </button>
            </form>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <Card className="bg-white/90 dark:bg-slate-900/60 border-primary/20 dark:border-primary/30 backdrop-blur-xl shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 dark:bg-primary/5 rounded-full blur-[80px] pointer-events-none" />
            {isArena && selectedBannerUrl && (
              <div className="w-full h-48 relative overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedBannerUrl} alt="Banner Preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
                <span className="absolute bottom-4 left-6 text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-950/60 backdrop-blur-md text-white border border-white/10">
                  {category} Contest Banner
                </span>
              </div>
            )}
            <CardHeader className="border-b border-slate-200 dark:border-slate-800/50">
              <div className="flex justify-between items-start">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 dark:bg-primary/10 border border-primary/20 text-primary dark:text-primary text-[10px] font-bold uppercase tracking-wider mb-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    Review & Tweak
                  </div>
                  <CardTitle className="text-2xl text-slate-900 dark:text-white font-black">Review Brief</CardTitle>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Total Budget</p>
                  <p className="text-2xl font-black text-primary">₹{budgetInr}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6 relative z-10">

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Format</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1 capitalize">{campaignType}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Creator Tier</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1 capitalize">{influencerTier}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Multi-Creator</p>
                  <p className="text-sm font-semibold text-primary mt-1">{allowFraction ? "Enabled" : "Disabled"}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 flex flex-col justify-center">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Status</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">Drafting</p>
                </div>
              </div>

              <div className="bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 space-y-6">

                <div className="space-y-2">
                  <Label className="text-primary/80 dark:text-primary/70 text-xs font-bold uppercase tracking-wider">Campaign Title</Label>
                  <Input value={aiTitle} onChange={(e) => setAiTitle(e.target.value)} className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700/50 focus:border-primary h-12 rounded-xl text-slate-900 dark:text-white font-bold" />
                </div>

                <div className="space-y-2">
                  <Label className="text-primary/80 dark:text-primary/70 text-xs font-bold uppercase tracking-wider">Campaign Overview / Hook</Label>
                  <textarea rows={3} value={aiDescription} onChange={(e) => setAiDescription(e.target.value)} className="w-full p-4 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none text-slate-900 dark:text-slate-200 leading-relaxed resize-none" />
                </div>

                <div className="space-y-2">
                  <Label className="text-primary/80 dark:text-primary/70 text-xs font-bold uppercase tracking-wider">Target Audience Details</Label>
                  <textarea rows={2} value={aiTargetAudience} onChange={(e) => setAiTargetAudience(e.target.value)} className="w-full p-4 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none text-slate-900 dark:text-slate-200 leading-relaxed resize-none" />
                </div>

                <div className="space-y-2">
                  <Label className="text-primary/80 dark:text-primary/70 text-xs font-bold uppercase tracking-wider">Deliverables, Dos & Don'ts</Label>
                  <textarea rows={6} value={aiRequirements} onChange={(e) => setAiRequirements(e.target.value)} className="w-full p-4 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none text-slate-900 dark:text-slate-200 leading-relaxed resize-y" />
                </div>

              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={() => setStep(2)} className="px-6 py-3.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white font-bold rounded-xl transition-colors cursor-pointer">
                  ← Back to Foundation
                </button>
                <button onClick={handlePublish} disabled={saving} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-black py-3.5 px-4 rounded-xl shadow-sm shadow-primary/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                  {saving ? "Deploying..." : "Launch Campaign 🚀"}
                </button>
              </div>

            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}
