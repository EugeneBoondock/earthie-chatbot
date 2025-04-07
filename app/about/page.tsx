import React from 'react';
import Link from 'next/link'; // Import Link for potential future links
import { Bot } from 'lucide-react'; // Example icon

export default function AboutPage() {
  return (
    // Container to center the content box
    <div className="container mx-auto px-4 flex justify-center">
      {/* Content box */}
      <div className="bg-gray-800 rounded-lg shadow-xl p-8 md:p-12 w-full max-w-4xl">
        {/* Remove prose for custom styling, add spacing */}
        <div className="max-w-none space-y-6">
          <div className="flex items-center space-x-3 mb-6">
            <Bot className="w-10 h-10 text-[#50E3C1]" />
            <h1 className="text-4xl md:text-5xl font-bold text-white border-b-2 border-[#50E3C1] pb-2">
              About Earthie
            </h1>
          </div>
          <p className="text-lg text-gray-300 leading-relaxed">
            Welcome to Earthie, your AI companion dedicated to the expansive universe of Earth 2!
          </p>
          <p className="text-lg text-gray-300 leading-relaxed">
            Earthie was conceived and brought to life through the collaborative efforts of 
            <strong className="text-[#50E3C1] font-semibold"> Eugene Boondock</strong> and 
            <strong className="text-[#50E3C1] font-semibold"> Mitch Glasgow</strong>. 
            Their vision was to create an intelligent assistant capable of navigating the complexities 
            of Earth 2, providing players with up-to-date information, insights, and assistance.
          </p>
          <p className="text-lg text-gray-300 leading-relaxed">
            Powered by advanced AI technology (including Google's Gemini models), Earthie continuously learns from the Earth 2 
            knowledge base, community discussions, official announcements, and developer insights 
            to offer the most accurate and helpful responses possible.
          </p>
          <p className="text-lg text-gray-300 leading-relaxed">
            Whether you're a newcomer looking for tips, a veteran strategist analyzing resources, 
            or just curious about the latest developments, Earthie is here to help enhance your 
            virtual world experience.
          </p>
          <hr className="border-gray-700 my-8" />
          <p className="text-center text-gray-400">
            Thank you for interacting with Earthie!
          </p>
        </div>
      </div>
    </div>
  );
} 