import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "近くの図書館を探す",
  description: "現在地から近くの図書館をOpenStreetMapで検索するサービス",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-800">
        {children}
      </body>
    </html>
  );
}
