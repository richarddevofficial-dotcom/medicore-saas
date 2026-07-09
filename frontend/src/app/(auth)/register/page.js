"use client";

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">
          Hospital Registration
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Self-registration is temporarily unavailable. Please contact support
          to onboard your hospital.
        </p>
        <div className="mt-6">
          <a
            href="/login"
            className="inline-flex items-center justify-center w-full px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to Sign In
          </a>
        </div>
      </div>
    </div>
  );
}
