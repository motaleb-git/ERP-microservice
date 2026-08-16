import Link from "next/link";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ERP",
  description: "Enterprise ERP management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto max-w-3xl px-6 py-10">
          <header className="mb-8 flex items-baseline justify-between">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              ERP
            </Link>
            <nav className="flex gap-4 text-sm text-slate-600">
              <Link href="/health" className="hover:text-slate-900">
                Health
              </Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
