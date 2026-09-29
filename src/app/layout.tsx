import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chachu ka Mittar",
  description: "Menu, ratings and feedback for your hostel mess",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
