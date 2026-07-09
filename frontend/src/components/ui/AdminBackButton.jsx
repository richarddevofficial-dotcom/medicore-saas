"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Button from "@/components/ui/Button";

export default function AdminBackButton() {
  const router = useRouter();
  const [canShow, setCanShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCanShow(localStorage.getItem("role") === "admin");
  }, []);

  if (!canShow) return null;

  return (
    <Button
      variant="ghost"
      icon={ArrowLeft}
      onClick={() => router.push("/admin")}
    >
      Back
    </Button>
  );
}
