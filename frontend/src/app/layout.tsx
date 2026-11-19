
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ApexiveAI CAD & BIM Suite",
  description:
    "International CAD, BIM, 3D Modeling and Construction Engineering Platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
