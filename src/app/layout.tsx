import type { Metadata } from "next";
import Providers from "@/components/Providers";
import Background from "@/components/ui/Background";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gmail Job Tracker",
  description: "Track job applications detected from your Gmail inbox.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-canvas text-ink">
        <Background />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
