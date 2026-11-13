"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Script from "next/script";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type Transaction = {
  id: string;
  amount: number;
  type: "credit" | "debit";
  description: string;
  status: string;
  createdAt: string;
};

type WalletData = {
  balance: number;
  transactions: Transaction[];
};

/**
 * `canAddFunds` is false for creators: they earn coins from brands and can't buy them,
 * because arenas are free to enter and coins have nothing else to pay for.
 */
export function WalletDashboard({ canAddFunds = true }: { canAddFunds?: boolean }) {
  const queryClient = useQueryClient();
  const [addAmount, setAddAmount] = useState<string>("500");
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: wallet, isLoading, error } = useQuery({
    queryKey: ["wallet"],
    queryFn: async () => {
      const res = await fetch("/api/wallet", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch wallet");
      const json = (await res.json()) as any;
      if (!json?.success) throw new Error(json.error);
      return json.data as WalletData;
    },
  });

  const handleAddFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addAmount || parseFloat(addAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsProcessing(true);
    const amountInPaise = Math.round(parseFloat(addAmount) * 100);

    try {
      // 1. Create order
      const orderRes = await fetch("/api/wallet/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountInPaise }),
      });
      const orderJson = (await orderRes.json()) as any;
      if (!orderJson.success) throw new Error(orderJson.error);

      const order = orderJson.data;

      // 2. Open Razorpay Checkout
      const options = {
        key: order.key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_mockkey", // Enter the Key ID generated from the Dashboard
        amount: order.amount,
        currency: order.currency,
        name: "RichyReach",
        description: "Add funds to Wallet",
        order_id: order.id,
        handler: async function (response: any) {
          try {
            // 3. Verify Payment
            const verifyRes = await fetch("/api/wallet/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                amount: amountInPaise,
              }),
            });
            const verifyJson = (await verifyRes.json()) as any;

            if (verifyJson.success) {
              toast.success(`Successfully added ₹${addAmount} to your wallet!`);
              queryClient.invalidateQueries({ queryKey: ["wallet"] });
              setAddAmount("");
            } else {
              toast.error(verifyJson.error || "Payment verification failed");
            }
          } catch (err) {
            toast.error("An error occurred during verification.");
          }
        },
        prefill: {
          name: "RichyReach User",
          email: "user@richyreach.com",
        },
        theme: {
          color: "#4f46e5", // primary color
        },
      };

      if (order.id.startsWith("order_mock_")) {
        // Mock payment success immediately
        options.handler({
          razorpay_payment_id: "pay_mock_" + Date.now(),
          razorpay_order_id: order.id,
          razorpay_signature: "mock_signature",
        });
      } else {
        const rzp = new (window as any).Razorpay(options);
        rzp.on("payment.failed", function (response: any) {
          toast.error(response.error.description);
        });
        rzp.open();
      }

    } catch (err: any) {
      toast.error(err.message || "Failed to initiate payment");
    } finally {
      setIsProcessing(false);
    }
  };

  if (error) {
    return <div className="p-8 text-center text-rose-500">Error loading wallet: {(error as Error).message}</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />

      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60 dark:from-primary dark:to-primary/50">
          My Wallet
        </h1>
        <p className="text-primary/80 dark:text-primary/60 text-sm mt-1">
          Manage your funds, add money, and view transaction history.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Available Balance</CardTitle>
            <CardDescription>Your current wallet funds</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-12 w-32" />
            ) : (
              <p className="text-4xl font-black text-primary">₹{((wallet?.balance || 0) / 100).toFixed(2)}</p>
            )}
          </CardContent>
        </Card>

        {canAddFunds && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Add Funds</CardTitle>
            <CardDescription>Instantly top up your wallet via Razorpay</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddFunds} className="flex flex-col gap-3">
              <div className="flex gap-2 mb-2">
                {[500, 1000, 5000].map(amt => (
                  <button key={amt} type="button" onClick={() => setAddAmount(String(amt))} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-primary/10 hover:border-primary/50 transition-colors">
                    + ₹{amt}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-500">₹</span>
                  <Input type="number" min="1" step="1" value={addAmount} onChange={e => setAddAmount(e.target.value)} className="pl-8" placeholder="Enter amount" />
                </div>
                <button type="submit" disabled={isProcessing || isLoading} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-2 h-10 rounded-xl shadow-sm transition-all disabled:opacity-50">
                  {isProcessing ? "Processing..." : "Add"}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
        )}
      </div>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : wallet?.transactions && wallet.transactions.length > 0 ? (
            <div className="space-y-0 divide-y divide-slate-100 dark:divide-slate-800">
              {wallet.transactions.map((tx) => (
                <div key={tx.id} className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'credit' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                      {tx.type === 'credit' ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white text-sm">{tx.description}</p>
                      <p className="text-xs text-slate-500">{new Date(tx.createdAt).toLocaleDateString()} • {tx.status}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-black ${tx.type === 'credit' ? 'text-emerald-500' : 'text-slate-900 dark:text-white'}`}>
                      {tx.type === 'credit' ? '+' : '-'}₹{(tx.amount / 100).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-slate-500">
              No transactions yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
