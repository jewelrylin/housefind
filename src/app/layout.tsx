import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HouseFind - 全台房市搜尋引擎 | 一站整合買屋、租屋、新成屋",
  description:
    "HouseFind 整合 591、信義房屋、永慶房屋、樂屋網、好房網、住商不動產等六大房仲平台，提供一站式中古屋買賣、新成屋及租屋查詢，自動過濾置頂廣告，精準搜尋理想物件。",
  keywords: [
    "房屋搜尋", "買屋", "租屋", "新成屋", "台灣房仲",
    "591", "信義房屋", "永慶房屋", "房價查詢",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-TW"
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
