'use client';

import { useState, useEffect } from "react";
import type { User } from '@supabase/supabase-js';
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { 
  ArrowRight, 
  Headphones, 
  Code, 
  MessageSquare, 
  Swords, 
  Info, 
  Calculator, 
  X as CloseIcon, 
  UserIcon, 
  Book, 
  Building,
  FileText,
  MapPin,
  Truck 
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePriceContext } from "@/contexts/PriceContext"; // Ensure PriceContext provider wraps layout
import { supabase } from '@/lib/supabase';

// This component contains all the original logic and JSX from app/page.tsx
export default function HomePageClientContent() {
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [essenceAmount, setEssenceAmount] = useState("");
  const [calculatedValue, setCalculatedValue] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [userLoaded, setUserLoaded] = useState(false);

  const {
      currentPrice: currentEssencePrice,
      selectedCurrency: selectedFiatCurrency,
      isLoadingPrice,
      isInitialising,
      priceError
   } = usePriceContext();

  useEffect(() => {
    if (isInitialising) {
        setCalculatedValue("Initializing...");
        return;
    }
    const amount = parseFloat(essenceAmount.replace(/,/g, ''));
    if (!isNaN(amount) && amount > 0 && currentEssencePrice && !isLoadingPrice && !priceError) {
      const value = amount * currentEssencePrice;
      const formattedValue = value.toLocaleString(undefined, {
        style: 'currency',
        currency: selectedFiatCurrency.toUpperCase(),
        minimumFractionDigits: 2,
        maximumFractionDigits: 4
      });
      setCalculatedValue(formattedValue);
    } else if (isLoadingPrice) {
      setCalculatedValue("Loading price...");
    } else if (priceError) {
       setCalculatedValue("Price error");
    } else {
      setCalculatedValue("---");
    }
  }, [essenceAmount, currentEssencePrice, selectedFiatCurrency, isLoadingPrice, priceError, isInitialising]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setUserLoaded(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setUserLoaded(true);
    });
    return () => listener?.subscription?.unsubscribe();
  }, []);

  const handleEssenceInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const value = e.target.value;
     if (/^\d*\.?\d*$/.test(value) || value === "") {
        setEssenceAmount(value);
     }
  };

  // --- Return the original JSX --- 
  return (
    <>
      {/* --- Hero Section --- */}
      <section className="container mx-auto px-4 flex justify-center py-12 md:py-16 lg:py-20">
        <div className="rounded-2xl bg-gradient-to-br from-[#0b0e13]/80 to-[#23243a]/70 border border-[#1d1f24] shadow-xl p-8 md:p-12 flex flex-col md:flex-row items-center gap-8 md:gap-12 w-full max-w-6xl">
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-3xl md:text-5xl font-bold mb-4 text-white leading-tight"> Meet Earthie, Your<br />Earth2 Companion </h1>
            <p className="text-lg text-gray-300 mb-8"> The AI chatbot that knows everything about Earth2. Get answers, discover tips, and enhance your virtual world experience. </p>
            <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start space-y-4 sm:space-y-0 sm:space-x-4">
              <Link href="/chat" passHref> <Button size="lg" className="bg-[#50E3C1] hover:bg-[#40c0a0] text-gray-900 font-semibold rounded-md w-full sm:w-auto px-8"> Chat with Earthie </Button> </Link>
              <Link href="/radio" passHref> <Button size="lg" variant="outline" className="bg-[#343547] text-white border-gray-600 hover:bg-gray-700 hover:text-white rounded-md w-full sm:w-auto px-8"> Listen to Radio </Button> </Link>
            </div>
          </div>
          <div className="flex-shrink-0"> 
            <picture>
              <source srcSet="/images/optimized/earthie_cover.webp" type="image/webp" />
              <Image 
                src="/images/optimized/earthie_cover_optimized.png" 
                alt="Earthie Hero Image" 
                width={300} 
                height={300} 
                className="rounded-lg shadow-lg object-contain" 
                priority
              />
            </picture>
          </div>
        </div>
      </section>

      {/* --- Info Alerts Section --- */}
      <section className="container mx-auto px-4 pb-10 md:pb-12 lg:pb-16 -mt-6 md:-mt-8 space-y-4">
        <Alert className="max-w-6xl mx-auto bg-emerald-900/50 border-emerald-700 text-emerald-200 backdrop-blur-sm">
          <Info className="h-4 w-4 text-emerald-300" />
          <AlertTitle className="text-emerald-200 font-semibold">Local Currency Available!</AlertTitle>
          <AlertDescription> Did you know? You can view the Essence price in the navbar ticker in your local currency. Use the dropdown menu next to the navigation links! </AlertDescription>
        </Alert>
        <Alert className="max-w-6xl mx-auto bg-emerald-900/50 border-emerald-700 text-emerald-200 backdrop-blur-sm">
          <Calculator className="h-4 w-4 text-emerald-300" />
          <AlertTitle className="text-emerald-200 font-semibold">Quick Essence Calculator</AlertTitle>
          <AlertDescription> Need to quickly check the value of your Essence? Click the <Calculator className="inline-block h-4 w-4 mx-1" /> icon in the bottom-right corner to open the calculator! </AlertDescription>
        </Alert>
      </section>

      {/* --- Features Section --- */}
      <section className="py-12 md:py-24 lg:py-32 bg-gray-900/50">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12 md:mb-16">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-white"> Everything You Need for Earth2 </h2>
              <p className="max-w-[900px] text-gray-300 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed"> Earthie provides comprehensive tools and resources for Earth2 enthusiasts. </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* AI Chat */}
            <div className="flex flex-col items-center space-y-4 p-6 rounded-2xl bg-gradient-to-br from-[#0b0e13]/80 to-[#23243a]/70 border border-[#1d1f24] relative">
              {userLoaded && !user && (
                <span className="absolute top-3 right-3 px-2 py-0.5 text-xs rounded bg-rose-500/30 text-rose-200 animate-pulse shadow-sm" style={{zIndex:2, fontWeight:500, letterSpacing:'0.02em'}}>Login Required</span>
              )}
              <div className="p-3 rounded-full bg-[#50E3C1]/20"> <MessageSquare className="w-8 h-8 text-[#50E3C1]" /> </div>
              <h3 className="text-xl font-bold text-white">AI Chat Assistant</h3>
              <p className="text-center text-gray-300 text-sm flex-grow"> Get instant answers to all your Earth2 questions from property management to gameplay strategies. </p>
              <Link href="/chat" passHref className="mt-auto pt-4"> <Button variant="outline" className="bg-[#343547] text-[#50E3C1] border-[#50E3C1] hover:bg-[#50E3C1]/10 hover:text-[#50E3C1]"> Start Chatting <ArrowRight className="ml-2 h-4 w-4" /> </Button> </Link>
            </div>
            {/* Profile */}
            <div className="flex flex-col items-center space-y-4 p-6 rounded-2xl bg-gradient-to-br from-[#0b0e13]/80 to-[#23243a]/70 border border-[#1d1f24] relative">
              {userLoaded && !user && (
                <span className="absolute top-3 right-3 px-2 py-0.5 text-xs rounded bg-rose-500/30 text-rose-200 animate-pulse shadow-sm" style={{zIndex:2, fontWeight:500, letterSpacing:'0.02em'}}>Login Required</span>
              )}
              <div className="p-3 rounded-full bg-earthie-mint/20"> <UserIcon className="w-8 h-8 text-earthie-mint" /> </div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">Profile</h3>
              <p className="text-center text-cyan-200/80 text-sm flex-grow">View your linked Earth2 profile, manage your properties, and track your net worth.</p>
              <Link href="/hub/profile" passHref className="mt-auto pt-4"> <Button variant="outline" className="bg-[#343547] text-earthie-mint border-earthie-mint hover:bg-earthie-mint/10 hover:text-earthie-mint"> Go to Profile <ArrowRight className="ml-2 h-4 w-4" /> </Button> </Link>
            </div>
            {/* E2pedia */}
            <div className="flex flex-col items-center space-y-4 p-6 rounded-2xl bg-gradient-to-br from-[#0b0e13]/80 to-[#23243a]/70 border border-[#1d1f24] relative">
              {userLoaded && !user && (
                <span className="absolute top-3 right-3 px-2 py-0.5 text-xs rounded bg-rose-500/30 text-rose-200 animate-pulse shadow-sm" style={{zIndex:2, fontWeight:500, letterSpacing:'0.02em'}}>Login Required</span>
              )}
              <div className="p-3 rounded-full bg-earthie-mint/20"> <Book className="w-8 h-8 text-earthie-mint" /> </div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">E2pedia</h3>
              <p className="text-center text-cyan-200/80 text-sm flex-grow">Browse official Earth2 announcements and access a growing knowledge base.</p>
              <Link href="/hub/e2pedia" passHref className="mt-auto pt-4"> <Button variant="outline" className="bg-[#343547] text-earthie-mint border-earthie-mint hover:bg-earthie-mint/10 hover:text-earthie-mint"> Open E2pedia <ArrowRight className="ml-2 h-4 w-4" /> </Button> </Link>
            </div>
            {/* My Lobbyist */}
            <div className="flex flex-col items-center space-y-4 p-6 rounded-2xl bg-gradient-to-br from-[#0b0e13]/80 to-[#23243a]/70 border border-[#1d1f24] relative">
              {userLoaded && !user && (
                <span className="absolute top-3 right-3 px-2 py-0.5 text-xs rounded bg-rose-500/30 text-rose-200 animate-pulse shadow-sm" style={{zIndex:2, fontWeight:500, letterSpacing:'0.02em'}}>Login Required</span>
              )}
              <div className="p-3 rounded-full bg-earthie-mint/20"> <Building className="w-8 h-8 text-earthie-mint" /> </div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">My Lobbyist</h3>
              <p className="text-center text-cyan-200/80 text-sm flex-grow">Join the community, share posts, comment, and react in the Earth2 social hub.</p>
              <Link href="/hub/lobbyist" passHref className="mt-auto pt-4"> <Button variant="outline" className="bg-[#343547] text-earthie-mint border-earthie-mint hover:bg-earthie-mint/10 hover:text-earthie-mint"> Visit Lobbyist <ArrowRight className="ml-2 h-4 w-4" /> </Button> </Link>
            </div>
            {/* Radio */}
            <div className="flex flex-col items-center space-y-4 p-6 rounded-2xl bg-gradient-to-br from-[#0b0e13]/80 to-[#23243a]/70 border border-[#1d1f24] relative">
              <div className="p-3 rounded-full bg-[#50E3C1]/20"> <Headphones className="w-8 h-8 text-[#50E3C1]" /> </div>
              <h3 className="text-xl font-bold text-white">Earth2 Radio</h3>
              <p className="text-center text-gray-300 text-sm flex-grow"> Listen to podcasts and updates about the latest developments in the Earth2 universe. </p>
              <Link href="/radio" passHref className="mt-auto pt-4"> <Button variant="outline" className="bg-[#343547] text-[#50E3C1] border-[#50E3C1] hover:bg-[#50E3C1]/10 hover:text-[#50E3C1]"> Listen Now <ArrowRight className="ml-2 h-4 w-4" /> </Button> </Link>
            </div>
            {/* Dev Tools */}
            <div className="flex flex-col items-center space-y-4 p-6 rounded-2xl bg-gradient-to-br from-[#0b0e13]/80 to-[#23243a]/70 border border-[#1d1f24] relative">
              <div className="p-3 rounded-full bg-[#50E3C1]/20"> <Code className="w-8 h-8 text-[#50E3C1]" /> </div>
              <h3 className="text-xl font-bold text-white">Developer Tools</h3>
              <p className="text-center text-gray-300 text-sm flex-grow"> Submit and share your Earth2 scripts to enhance the community experience. </p>
              <Link href="/script-tools" passHref className="mt-auto pt-4"> <Button variant="outline" className="bg-[#343547] text-[#50E3C1] border-[#50E3C1] hover:bg-[#50E3C1]/10 hover:text-[#50E3C1]"> Explore Tools <ArrowRight className="ml-2 h-4 w-4" /> </Button> </Link>
            </div>
            {/* Raid Helper */}
            <div className="flex flex-col items-center space-y-4 p-6 rounded-2xl bg-gradient-to-br from-[#0b0e13]/80 to-[#23243a]/70 border border-[#1d1f24] relative">
              <div className="p-3 rounded-full bg-[#50E3C1]/20"> <Swords className="w-8 h-8 text-[#50E3C1]" /> </div>
              <h3 className="text-xl font-bold text-white">Raid Helper</h3>
              <p className="text-center text-gray-300 text-sm flex-grow"> Analyze your raiding performance! Upload your exported raid data CSV to visualize success rates, E-ther gains, and top targets. </p>
              <Link href="/raid-helper" passHref className="mt-auto pt-4"> <Button variant="outline" className="bg-[#343547] text-[#50E3C1] border-[#50E3C1] hover:bg-[#50E3C1]/10 hover:text-[#50E3C1]"> Analyze Raids <ArrowRight className="ml-2 h-4 w-4" /> </Button> </Link>
            </div>
            {/* Essence Tracker */}
            <div className="flex flex-col items-center space-y-4 p-6 rounded-2xl bg-gradient-to-br from-[#0b0e13]/80 to-[#23243a]/70 border border-[#1d1f24] relative">
              {userLoaded && !user && (
                <span className="absolute top-3 right-3 px-2 py-0.5 text-xs rounded bg-rose-500/30 text-rose-200 animate-pulse shadow-sm" style={{zIndex:2, fontWeight:500, letterSpacing:'0.02em'}}>Login Required</span>
              )}
              <div className="p-3 rounded-full bg-[#50E3C1]/20"> <Calculator className="w-8 h-8 text-[#50E3C1]" /> </div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">Essence Tracker</h3>
              <p className="text-center text-gray-300 text-sm flex-grow"> Track Essence price, view interactive charts, analyze wallet balances, and monitor buy/sell activity for the E2-E token. </p>
              <Link href="/hub/essence" passHref className="mt-auto pt-4"> <Button variant="outline" className="bg-[#343547] text-[#50E3C1] border-[#50E3C1] hover:bg-[#50E3C1]/10 hover:text-[#50E3C1]"> Open Tracker <ArrowRight className="ml-2 h-4 w-4" /> </Button> </Link>
            </div>
            <div className="flex flex-col items-center space-y-4 p-6 rounded-2xl bg-gradient-to-br from-[#0b0e13]/80 to-[#23243a]/70 border border-[#1d1f24] relative">
              {userLoaded && !user && (
                <span className="absolute top-3 right-3 px-2 py-0.5 text-xs rounded bg-rose-500/30 text-rose-200 animate-pulse shadow-sm" style={{zIndex:2, fontWeight:500, letterSpacing:'0.02em'}}>Login Required</span>
              )}
              <div className="p-3 rounded-full bg-[#50E3C1]/20"> <FileText className="w-8 h-8 text-[#50E3C1]" /> </div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">Essence Report</h3>
              <p className="text-center text-gray-300 text-sm flex-grow"> Comprehensive analytics and insights for the E2-E token ecosystem with historical data tracking and weekly reports. </p>
              <Link href="/hub/essence-report" passHref className="mt-auto pt-4"> <Button variant="outline" className="bg-[#343547] text-[#50E3C1] border-[#50E3C1] hover:bg-[#50E3C1]/10 hover:text-[#50E3C1]"> View Report <ArrowRight className="ml-2 h-4 w-4" /> </Button> </Link>
            </div>
            {/* Logistics Command Center */}
            <div className="flex flex-col items-center space-y-4 p-6 rounded-2xl bg-gradient-to-br from-[#0b0e13]/80 to-[#23243a]/70 border border-[#1d1f24] relative">
              {userLoaded && !user && (
                <span className="absolute top-3 right-3 px-2 py-0.5 text-xs rounded bg-rose-500/30 text-rose-200 animate-pulse shadow-sm" style={{zIndex:2, fontWeight:500, letterSpacing:'0.02em'}}>Login Required</span>
              )}
              <div className="p-3 rounded-full bg-cyan-400/20"> <Truck className="w-8 h-8 text-cyan-400" /> </div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">Logistics Command Center</h3>
              <p className="text-center text-gray-300 text-sm flex-grow"> Advanced property logistics planning with interactive satellite maps, intelligent routing, multi-modal transport, and country-based search capabilities. </p>
              <Link href="/hub/logistics" passHref className="mt-auto pt-4"> <Button variant="outline" className="bg-[#343547] text-cyan-400 border-cyan-400 hover:bg-cyan-400/10 hover:text-cyan-400"> Open Command Center <ArrowRight className="ml-2 h-4 w-4" /> </Button> </Link>
            </div>
          </div>
        </div>
      </section>

      {/* --- Call to Action Section --- */}
      <section className="py-12 md:py-24 lg:py-32">
        <div className="container mx-auto px-4 md:px-6">
          <div className="rounded-2xl bg-gradient-to-br from-[#0b0e13]/80 to-[#23243a]/70 border border-[#1d1f24] shadow-xl flex flex-col items-center justify-center space-y-4 text-center py-12 px-4 md:px-12">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-white"> Ready to Explore Earth2? </h2>
              <p className="max-w-[600px] text-gray-300 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed"> Start chatting with Earthie today and unlock the full potential of your virtual world experience. </p>
            </div>
            <div className="mt-6">
              <Link href="/chat" passHref> <Button size="lg" className="bg-[#50E3C1] hover:bg-[#40c0a0] text-gray-900 font-semibold rounded-md px-8"> Get Started <ArrowRight className="ml-2 h-4 w-4" /> </Button> </Link>
            </div>
          </div>
        </div>
      </section>

      {/* --- Floating Calculator --- */}
      <>
        <button
          onClick={() => setIsCalculatorOpen(!isCalculatorOpen)}
          className="fixed bottom-4 right-4 z-40 p-3 bg-[#50E3C1] hover:bg-[#40c0a0] text-gray-900 rounded-full shadow-lg transition-transform duration-200 ease-in-out hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#50E3C1] focus:ring-offset-2 focus:ring-offset-gray-900"
          aria-label={isCalculatorOpen ? "Close Essence Calculator" : "Open Essence Calculator"}
        >
          <Calculator className="w-6 h-6" />
        </button>

        {isCalculatorOpen && (
          <div className="fixed bottom-20 right-4 z-40 w-full max-w-xs bg-gray-800/90 backdrop-blur-md border border-gray-700 rounded-lg shadow-xl p-4 transition-opacity duration-300 ease-in-out">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-semibold text-white">Essence Calculator</h4>
              <button onClick={() => setIsCalculatorOpen(false)} className="text-gray-400 hover:text-white" aria-label="Close Calculator">
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="essence-amount" className="text-sm font-medium text-gray-300"> Essence Amount </Label>
                <Input
                  id="essence-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g., 10000.5"
                  value={essenceAmount}
                  onChange={handleEssenceInputChange}
                  className="mt-1 bg-gray-700 border-gray-600 text-white focus:border-[#50E3C1] focus:ring-[#50E3C1]"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-300"> Estimated Value ({!isInitialising ? selectedFiatCurrency.toUpperCase() : '...'}) </Label>
                 <div className={`mt-1 p-2 rounded bg-gray-700 text-lg font-semibold ${priceError ? 'text-red-400' : 'text-[#50E3C1]'}`}>
                   {calculatedValue}
                 </div>
              </div>
              {priceError && !isLoadingPrice && (
                 <p className="text-xs text-red-400" title={priceError}>Price Error</p>
              )}
              {!isLoadingPrice && !priceError && currentEssencePrice && !isInitialising && (
                <p className="text-xs text-gray-400">
                  Base price: {currentEssencePrice.toLocaleString(undefined, {style:'currency', currency: selectedFiatCurrency.toUpperCase(), maximumSignificantDigits: 4})} / E2E
                </p>
              )}
              {(isLoadingPrice || isInitialising) && !priceError && (
                 <p className="text-xs text-gray-400 animate-pulse">Fetching latest price...</p>
              )}
            </div>
          </div>
        )}
      </>
    </>
  );
} 