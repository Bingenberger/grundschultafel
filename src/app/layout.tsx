import type { Metadata } from "next";
import { Quicksand } from "next/font/google";
import "./globals.css";

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TafelPopafel",
  description: "Eine interaktive Tafel für den Unterricht.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <head>
        <link rel="stylesheet" media="screen" href="https://fontlibrary.org/face/grundschrift" type="text/css"/>
      </head>
      <body
        className={`${quicksand.variable} antialiased`}
        style={{ fontFamily: "var(--font-quicksand), sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
