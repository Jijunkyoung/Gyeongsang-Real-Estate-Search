import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "영남 부동산 아틀라스",
  description: "경상권 지역별 분양·정비사업·연도별 공급량 통합 탐색",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  other: {
    "codex-preview": "development",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
