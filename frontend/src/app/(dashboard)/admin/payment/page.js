"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function LegacyPaymentPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/settings/billing");
  }, [router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="animate-spin text-orange-500" size={36} />
    </div>
  );
}
