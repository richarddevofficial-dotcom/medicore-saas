"use client";

import { useState } from "react";

export default function AuthLayout({ children, title, subtitle }) {
  const [logoIndex, setLogoIndex] = useState(0);
  const logoSources = [
    "/brand/hospital-default-logo.svg",
    "/brand/logo-icon.svg",
  ];
  const activeLogo = logoSources[logoIndex] || "";

  return (
    <div className="min-h-screen bg-gray-50 bg-[url('/images/auth/login-hero.svg')] bg-cover bg-center flex flex-col justify-center px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="mx-auto w-full max-w-md">
        <div className="flex justify-center">
          {!activeLogo ? (
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-sm">
              <span className="text-white text-base font-bold tracking-wide">
                MC
              </span>
            </div>
          ) : (
            <div className="h-16 w-16 rounded-2xl bg-white border border-gray-100 shadow-sm p-2 flex items-center justify-center">
              <img
                src={activeLogo}
                alt="MediCore"
                className="h-full w-full object-contain"
                onError={() => setLogoIndex((prev) => prev + 1)}
              />
            </div>
          )}
        </div>

        <h2 className="mt-6 text-center text-2xl font-bold text-gray-900">
          {title}
        </h2>

        {subtitle && (
          <p className="mt-2 px-2 text-center text-sm text-gray-600 break-words">
            {subtitle}
          </p>
        )}
      </div>

      <div className="mt-6 mx-auto w-full max-w-md sm:mt-8">
        <div className="bg-white py-6 px-4 shadow-lg rounded-xl border border-gray-100 sm:px-10 sm:py-8">
          {children}
        </div>
      </div>
    </div>
  );
}
