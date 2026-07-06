"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import { FileQuestion, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center">
            <FileQuestion className="h-8 w-8 text-gray-400" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Page Not Found
        </h2>

        <p className="text-sm text-gray-500 mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <Link href="/dashboard">
          <Button icon={Home}>Back to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
