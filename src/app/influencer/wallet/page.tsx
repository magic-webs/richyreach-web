import { WalletDashboard } from "@/components/wallet/WalletDashboard";

export default function InfluencerWalletPage() {
  return (
    <div className="p-6">
      <WalletDashboard canAddFunds={false} />
    </div>
  );
}
