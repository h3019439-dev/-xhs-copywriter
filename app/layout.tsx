import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "66专用文案生成器 - 护肤专属",
  description: "输入产品信息，一键生成6版小红书爆款笔记，支持多轮迭代修改",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
