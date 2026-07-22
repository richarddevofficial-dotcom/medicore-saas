"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function HRError({ error, reset }) {
  useEffect(() => {
    console.error("HR module error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-4">
          <div className="h-14 w-14 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          HR Module Error
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          {error?.message || "Something went wrong loading this HR page."}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
