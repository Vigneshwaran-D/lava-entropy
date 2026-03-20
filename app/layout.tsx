import React from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
    title: "LavaEntropy — Digital Entropy Engine",
    description:
        "Visual chaos meets cryptographic randomness. WebGL lava simulation feeds a continuously seeded entropy pool to generate unpredictable random values.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
    return (
        <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
            <body>{children}</body>
        </html>
    );
}
