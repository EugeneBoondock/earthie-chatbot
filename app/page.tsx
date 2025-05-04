// app/page.tsx or wherever your Home component is
"use client";

import { useState, useEffect } from "react"; // Removed useMemo as it wasn't explicitly needed here
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Headphones, Code, MessageSquare, Swords, Info, Calculator, X as CloseIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePriceContext } from "@/contexts/PriceContext"; // Import the custom hook

export default function Home() {
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [essenceAmount, setEssenceAmount] = useState("");
  const [calculatedValue, setCalculatedValue] = useState("");

  // --- Consume Price Context ---
  const {
      currentPrice: currentEssencePrice, // Renamed for clarity within this component
      selectedCurrency: selectedFiatCurrency, // Renamed for clarity
      isLoadingPrice,
      isInitialising, // Use this to know if price system is ready
      priceError
   } = usePriceContext();

  // Calculate value when inputs change or price data updates
  useEffect(() => {
    // Ensure the price system is ready before calculating
    if (isInitialising) {
        setCalculatedValue("Initializing...");
        return;
    }

    const amount = parseFloat(essenceAmount.replace(/,/g, '')); // Handle potential commas

    if (!isNaN(amount) && amount > 0 && currentEssencePrice && !isLoadingPrice && !priceError) {
      const value = amount * currentEssencePrice;
      const formattedValue = value.toLocaleString(undefined, {
        style: 'currency',
        currency: selectedFiatCurrency.toUpperCase(), // Use currency from context
        minimumFractionDigits: 2,
        maximumFractionDigits: 4
      });
      setCalculatedValue(formattedValue);
    } else if (isLoadingPrice) {
      setCalculatedValue("Loading price...");
    } else if (priceError) {
       setCalculatedValue("Price error");
    }
     else {
      setCalculatedValue("---"); // Reset if input is invalid or price unavailable/null
    }
  }, [essenceAmount, currentEssencePrice, selectedFiatCurrency, isLoadingPrice, priceError, isInitialising]);

  const handleEssenceInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const value = e.target.value;
     // Allow only numbers and a single optional decimal point
     if (/^\d*\.?\d*$/.test(value) || value === "") {
        setEssenceAmount(value);
     }
  };

  return (
    <>
      {/* --- Hero Section --- */}
      <section className="container mx-auto px-4 flex justify-center py-12 md:py-16 lg:py-20">
        <div className="bg-gray-800 rounded-lg shadow-xl p-8 md:p-12 flex flex-col md:flex-row items-center gap-8 md:gap-12 w-full max-w-6xl">
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-3xl md:text-5xl font-bold mb-4 text-white leading-tight"> Meet Earthie, Your<br />Earth2 Companion </h1>
            <p className="text-lg text-gray-300 mb-8"> The AI chatbot that knows everything about Earth2. Get answers, discover tips, and enhance your virtual world experience. </p>
            <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start space-y-4 sm:space-y-0 sm:space-x-4">
              <Link href="/chat" passHref> <Button size="lg" className="bg-[#50E3C1] hover:bg-[#40c0a0] text-gray-900 font-semibold rounded-md w-full sm:w-auto px-8"> Chat with Earthie </Button> </Link>
              <Link href="/radio" passHref> <Button size="lg" variant="outline" className="bg-[#343547] text-white border-gray-600 hover:bg-gray-700 hover:text-white rounded-md w-full sm:w-auto px-8"> Listen to Radio </Button> </Link>
            </div>
          </div>
          <div className="flex-shrink-0"> <Image src="/images/earthie_cover.png" alt="Earthie Hero Image" width={300} height={300} className="rounded-lg shadow-lg object-contain" /> </div>
        </div>
      </section>

      {/* --- Currency Info Alert --- */}
      <section className="container mx-auto px-4 pb-10 md:pb-12 lg:pb-16 -mt-6 md:-mt-8">
        <Alert className="max-w-6xl mx-auto bg-blue-900/50 border-blue-700 text-blue-200 backdrop-blur-sm">
          <Info className="h-4 w-4 text-blue-300" />
          <AlertTitle className="text-blue-200 font-semibold">Local Currency Available!</AlertTitle>
          <AlertDescription> Did you know? You can view the Essence price in the navbar ticker in your local currency. Use the dropdown menu next to the navigation links! </AlertDescription>
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
            <div className="flex flex-col items-center space-y-4 p-6 border border-gray-700 rounded-lg bg-gray-800">
              <div className="p-3 rounded-full bg-[#50E3C1]/20"> <MessageSquare className="w-8 h-8 text-[#50E3C1]" /> </div>
              <h3 className="text-xl font-bold text-white">AI Chat Assistant</h3>
              <p className="text-center text-gray-300 text-sm flex-grow"> Get instant answers to all your Earth2 questions from property management to gameplay strategies. </p>
              <Link href="/chat" passHref className="mt-auto pt-4"> <Button variant="outline" className="bg-[#343547] text-[#50E3C1] border-[#50E3C1] hover:bg-[#50E3C1]/10 hover:text-[#50E3C1]"> Start Chatting <ArrowRight className="ml-2 h-4 w-4" /> </Button> </Link>
            </div>
            {/* Radio */}
            <div className="flex flex-col items-center space-y-4 p-6 border border-gray-700 rounded-lg bg-gray-800">
              <div className="p-3 rounded-full bg-[#50E3C1]/20"> <Headphones className="w-8 h-8 text-[#50E3C1]" /> </div>
              <h3 className="text-xl font-bold text-white">Earth2 Radio</h3>
              <p className="text-center text-gray-300 text-sm flex-grow"> Listen to podcasts and updates about the latest developments in the Earth2 universe. </p>
              <Link href="/radio" passHref className="mt-auto pt-4"> <Button variant="outline" className="bg-[#343547] text-[#50E3C1] border-[#50E3C1] hover:bg-[#50E3C1]/10 hover:text-[#50E3C1]"> Listen Now <ArrowRight className="ml-2 h-4 w-4" /> </Button> </Link>
            </div>
            {/* Dev Tools */}
            <div className="flex flex-col items-center space-y-4 p-6 border border-gray-700 rounded-lg bg-gray-800">
              <div className="p-3 rounded-full bg-[#50E3C1]/20"> <Code className="w-8 h-8 text-[#50E3C1]" /> </div>
              <h3 className="text-xl font-bold text-white">Developer Tools</h3>
              <p className="text-center text-gray-300 text-sm flex-grow"> Submit and share your Earth2 scripts to enhance the community experience. </p>
              <Link href="/script-tools" passHref className="mt-auto pt-4"> <Button variant="outline" className="bg-[#343547] text-[#50E3C1] border-[#50E3C1] hover:bg-[#50E3C1]/10 hover:text-[#50E3C1]"> Explore Tools <ArrowRight className="ml-2 h-4 w-4" /> </Button> </Link>
            </div>
            {/* Raid Helper */}
            <div className="flex flex-col items-center space-y-4 p-6 border border-gray-700 rounded-lg bg-gray-800">
              <div className="p-3 rounded-full bg-[#50E3C1]/20"> <Swords className="w-8 h-8 text-[#50E3C1]" /> </div>
              <h3 className="text-xl font-bold text-white">Raid Helper</h3>
              <p className="text-center text-gray-300 text-sm flex-grow"> Analyze your raiding performance! Upload your exported raid data CSV to visualize success rates, E-ther gains, and top targets. </p>
              <Link href="/raid-helper" passHref className="mt-auto pt-4"> <Button variant="outline" className="bg-[#343547] text-[#50E3C1] border-[#50E3C1] hover:bg-[#50E3C1]/10 hover:text-[#50E3C1]"> Analyze Raids <ArrowRight className="ml-2 h-4 w-4" /> </Button> </Link>
            </div>
          </div>
        </div>
      </section>

      {/* --- Call to Action Section --- */}
      <section className="py-12 md:py-24 lg:py-32 bg-gray-900">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
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
        {/* Toggle Button */}
        <button
          onClick={() => setIsCalculatorOpen(!isCalculatorOpen)}
          className="fixed bottom-4 right-4 z-40 p-3 bg-[#50E3C1] hover:bg-[#40c0a0] text-gray-900 rounded-full shadow-lg transition-transform duration-200 ease-in-out hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#50E3C1] focus:ring-offset-2 focus:ring-offset-gray-900"
          aria-label={isCalculatorOpen ? "Close Essence Calculator" : "Open Essence Calculator"}
        >
          <Calculator className="w-6 h-6" />
        </button>

        {/* Calculator Panel */}
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
                  type="text" // Use text for flexible input formatting
                  inputMode="decimal" // Hint for mobile keyboards
                  placeholder="e.g., 10000.5"
                  value={essenceAmount}
                  onChange={handleEssenceInputChange}
                  className="mt-1 bg-gray-700 border-gray-600 text-white focus:border-[#50E3C1] focus:ring-[#50E3C1]"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-300"> Estimated Value ({!isInitialising ? selectedFiatCurrency.toUpperCase() : '...'}) </Label>
                 <div className={`mt-1 p-2 rounded bg-gray-700 text-lg font-semibold ${priceError ? 'text-red-400' : 'text-[#50E3C1]'}`}>
                   {/* Display calculated value based on context state */}
                   {calculatedValue}
                 </div>
              </div>
              {/* Show price error from context */}
              {priceError && !isLoadingPrice && (
                 <p className="text-xs text-red-400" title={priceError}>Price Error</p>
              )}
              {/* Show base price used, ensuring not loading/error */}
              {!isLoadingPrice && !priceError && currentEssencePrice && !isInitialising && (
                <p className="text-xs text-gray-400">
                  Base price: {currentEssencePrice.toLocaleString(undefined, {style:'currency', currency: selectedFiatCurrency.toUpperCase(), maximumSignificantDigits: 4})} / E2E
                </p>
              )}
              {/* Show general loading indicator */}
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