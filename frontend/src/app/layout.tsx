import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KineticMesh // Zero-Trust Kinematic Swarm Consensus",
  description:
    "Decentralized Zero-Trust Airspace Consensus for Autonomous Drone Swarms Navigating Contested, GPS-Spoofed Environments. Track: Cybersecurity + Dual-Use Technology.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#07090e] text-slate-200">
        {children}
      </body>
    </html>
  );
}
