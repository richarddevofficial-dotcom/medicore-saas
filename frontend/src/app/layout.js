import { Inter } from "next/font/google";
import QueryProvider from "@/providers/QueryProvider";
import "@/styles/globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "MediCore HMS",
  description: "Hospital Management System",
  manifest: "/site.webmanifest",
  icons: {
    icon: [{ url: "/brand/logo-icon.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/brand/logo-icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/brand/logo-icon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
