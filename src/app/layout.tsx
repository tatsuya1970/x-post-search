import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { XApiProvider } from "@/context/XApiContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "X投稿検索",
  description: "Xの投稿を検索してCSV形式で保存するツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={inter.className} style={{ paddingLeft: 64, paddingRight: 64, boxSizing: 'border-box' }}>
        <div style={{ minHeight: '100vh' }}>
          <XApiProvider>
            {children}
          </XApiProvider>
        </div>
      </body>
    </html>
  );
}
