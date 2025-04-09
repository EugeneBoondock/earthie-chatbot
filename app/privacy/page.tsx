import React from 'react';
import { ShieldCheck } from 'lucide-react'; // Example icon

export default function PrivacyPage() {
  return (
    // Container to center the content box
    <div className="container mx-auto px-4 flex justify-center">
      {/* Content box */}
      <div className="bg-gray-800 rounded-lg shadow-xl p-8 md:p-12 w-full max-w-4xl">
        {/* Remove prose, add custom styling and spacing */}
        <div className="max-w-none space-y-6 text-gray-300">
          <div className="flex items-center space-x-3 mb-6">
              <ShieldCheck className="w-10 h-10 text-[#50E3C1]" />
              <h1 className="text-4xl md:text-5xl font-bold text-white border-b-2 border-[#50E3C1] pb-2">
                  Privacy Policy
              </h1>
          </div>
          <p className="text-sm text-gray-400 italic">Last Updated: April 7, 2025</p>

          <h2 className="text-2xl font-semibold text-white pt-4">1. Introduction</h2>
          <p className="leading-relaxed">
            Welcome to Earthie ("we," "us," or "our"). We are committed to protecting your personal 
            information and your right to privacy. This Privacy Policy explains how we collect, 
            use, disclose, and safeguard your information when you use our chatbot service.
          </p>

          <h2 className="text-2xl font-semibold text-white pt-4">2. Information We Collect</h2>
          <p className="leading-relaxed">
            We may collect the following types of information:
          </p>
          <ul className="list-disc list-outside space-y-2 pl-6 leading-relaxed">
            <li>
              <strong>Interaction Data:</strong> We collect the messages you send to Earthie and the 
              responses provided. This data is used solely to improve the chatbot's performance, 
              accuracy, and safety.
            </li>
            <li>
              <strong>Technical Data:</strong> We may collect technical information automatically, such as 
              IP address (anonymized if possible), browser type, and usage patterns, purely for 
              operational and analytical purposes (e.g., identifying errors, server load).
            </li>
          </ul>
          <p className="leading-relaxed mt-4">
            We do not intentionally collect personally identifiable information (PII) unless you 
            voluntarily provide it within your chat messages. We strongly advise against sharing 
            sensitive personal data.
          </p>

          <h2 className="text-2xl font-semibold text-white pt-4">3. How We Use Your Information</h2>
          <p className="leading-relaxed">
            We use the collected information to:
          </p>
          <ul className="list-disc list-outside space-y-2 pl-6 leading-relaxed">
            <li>Provide, operate, and maintain the chatbot service.</li>
            <li>Improve, personalize, and expand the chatbot service.</li>
            <li>Understand and analyze how you use the chatbot service.</li>
            <li>Develop new features and functionality.</li>
            <li>Monitor for and prevent prohibited activities and ensure safety.</li>
          </ul>

          <h2 className="text-2xl font-semibold text-white pt-4">4. Sharing Your Information</h2>
          <p className="leading-relaxed">
            We do not sell or rent your information to third parties. Your chat interactions may be 
            processed by underlying AI model providers (e.g., Google Gemini) solely for the purpose 
            of generating responses and are subject to their respective privacy policies and safety 
            measures. We do not share interaction data for third-party advertising.
          </p>

          <h2 className="text-2xl font-semibold text-white pt-4">5. Data Retention</h2>
          <p className="leading-relaxed">
            We retain interaction data only as long as necessary to fulfill the purposes outlined 
            in this policy, improve the service, and comply with legal obligations. 
            {/* Specify retention period or criteria if possible */}
          </p>

          <h2 className="text-2xl font-semibold text-white pt-4">6. Security</h2>
          <p className="leading-relaxed">
            We implement reasonable security measures to protect your information, but no electronic 
            transmission or storage is 100% secure.
          </p>

          <h2 className="text-2xl font-semibold text-white pt-4">7. Your Choices</h2>
          <p className="leading-relaxed">
            {/* Explain any user choices */}. Currently, the primary way to control 
            data shared is by being mindful of the information you provide in chat messages.
          </p>

          <h2 className="text-2xl font-semibold text-white pt-4">8. Changes to This Policy</h2>
          <p className="leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify you of any changes 
            by posting the new Privacy Policy on this page.
          </p>

          <h2 className="text-2xl font-semibold text-white pt-4">9. Contact Us</h2>
          <p className="leading-relaxed">
            If you have any questions about this Privacy Policy, please contact us at: 
            <a href="mailto:eugeneboondock@gmail.com" className="text-[#50E3C1] hover:underline">eugeneboondock@gmail.com</a>.
          </p>
        </div>
      </div>
    </div>
  );
} 