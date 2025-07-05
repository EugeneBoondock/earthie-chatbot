"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy } from "lucide-react";

const DONATE_ADDRESS = "0x7a82906cf62447aaaff84e7a1f58615d317c3eb9";
const TOKEN_ADDRESS = "0x2c0687215Aca7F5e2792d956E170325e92A02aCA";

export default function DonatePage() {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=ethereum:${DONATE_ADDRESS}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(DONATE_ADDRESS);
      toast.success("Address copied to clipboard");
    } catch {
      toast.error("Failed to copy address");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center overflow-hidden py-12 px-4 relative">
      {/* (Removed custom glow backgrounds to reveal global topographic pattern) */}

      {/* Card */}
      <div className="relative max-w-lg w-full bg-[#0b0e13]/60 border border-[#2a2c35]/80 backdrop-blur-lg rounded-2xl p-8 md:p-10 text-center shadow-xl space-y-8">
        {/* Floating Earthie logo */}
        <div className="absolute -top-14 left-1/2 -translate-x-1/2">
          <div className="relative w-24 h-24 rounded-full overflow-hidden shadow-lg ring-4 ring-[#50E3C1]/40">
            <picture>
              <source srcSet="/images/optimized/earthie_logo.webp" type="image/webp" />
              <Image src="/images/optimized/earthie_logo_optimized.png" alt="Earthie Logo" fill className="object-cover" />
            </picture>
          </div>
        </div>

        <h1 className="text-3xl md:text-4xl font-extrabold text-white pt-10 pb-2 tracking-wide">
          <span className="earthie-text-gradient">Support Earthie</span>
        </h1>
        <p className="text-gray-300 text-sm md:text-base max-w-prose mx-auto">
          Love using Earthie? Help keep the servers running and fuel future features by donating Ethereum (ETH) or Earth2 Essence (ESS) to the address below.
        </p>

        {/* QR Code */}
        <div className="flex justify-center">
          <Image
            src={qrUrl}
            alt="Donate QR Code"
            width={260}
            height={260}
            className="rounded-md border border-[#1d1f24] shadow-lg"
          />
        </div>

        {/* Address box */}
        <div className="relative bg-[#15171f]/80 border border-[#1d1f24] rounded-md p-4 break-all text-gray-100 font-mono text-sm shadow-inner backdrop-blur-sm">
          {DONATE_ADDRESS}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 text-gray-400 hover:text-white"
            onClick={handleCopy}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-xs text-gray-400 leading-relaxed">
          • Network: Ethereum Mainnet<br />
          • Essence (ESS) Token contract: <a href={`https://etherscan.io/token/${TOKEN_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="text-earthie-mint underline hover:text-earthie-mint/80">{TOKEN_ADDRESS}</a><br />
          • Donations are optional but deeply appreciated 💚
        </p>

        {/* Fiat donations */}
        <div className="pt-2">
          <p className="text-gray-300 text-sm mb-2">Prefer to donate with card or PayPal?</p>
          <a
            href="https://coff.ee/eugeneboondock"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-amber-400 hover:bg-amber-300 text-gray-900 font-semibold px-5 py-2 rounded-lg shadow transition-colors duration-150"
          >
            Donate via Coffee (Fiat)
          </a>
        </div>

        <style jsx>{`
          .earthie-text-gradient {
            background: linear-gradient(to right, #50E3C1, #38bdf8);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
          }
          @keyframes pulse-slow { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; } }
          .animate-pulse-slow { animation: pulse-slow 8s ease-in-out infinite; }
          .animate-pulse-slower { animation: pulse-slow 12s ease-in-out infinite; }
        `}</style>
      </div>
    </main>
  );
} 