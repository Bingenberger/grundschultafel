import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grundschultafel",
  description: "Eine interaktive Tafel für den Unterricht.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body
        className="antialiased"
        style={{ fontFamily: "system-ui, sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
