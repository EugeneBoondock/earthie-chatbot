import React from 'react';
import { FileText } from 'lucide-react'; // Example icon

export default function TermsPage() {
  return (
    // Container to center the content box
    <div className="container mx-auto px-4 flex justify-center">
      {/* Content box */}
      <div className="bg-gray-800 rounded-lg shadow-xl p-8 md:p-12 w-full max-w-4xl">
        {/* Remove prose, add custom styling and spacing */}
        <div className="max-w-none space-y-6 text-gray-300">
           <div className="flex items-center space-x-3 mb-6">
              <FileText className="w-10 h-10 text-[#50E3C1]" />
              <h1 className="text-4xl md:text-5xl font-bold text-white border-b-2 border-[#50E3C1] pb-2">
                  Terms of Service
              </h1>
          </div>
          <p className="text-sm text-gray-400 italic">Last Updated: April 7, 2025</p>

          <h2 className="text-2xl font-semibold text-white pt-4">1. Acceptance of Terms</h2>
          <p className="leading-relaxed">
            By accessing or using the Earthie chatbot service ("Service"), you agree to be bound 
            by these Terms of Service ("Terms"). If you disagree with any part of the terms, 
            then you may not access the Service.
          </p>

          <h2 className="text-2xl font-semibold text-white pt-4">2. Description of Service</h2>
          <p className="leading-relaxed">
            Earthie provides information and answers related to the Earth 2 virtual world based on 
            publicly available data, community information, and its underlying AI model's knowledge. 
            The information provided is for informational purposes only and should not be considered 
            financial, investment, or definitive advice. Accuracy is strived for but cannot be guaranteed.
          </p>

          <h2 className="text-2xl font-semibold text-white pt-4">3. User Conduct</h2>
          <p className="leading-relaxed">
            You agree not to use the Service:
          </p>
          <ul className="list-disc list-outside space-y-2 pl-6 leading-relaxed">
            <li>For any unlawful purpose.</li>
            <li>To solicit others to perform or participate in any unlawful acts.</li>
            <li>To violate any international, federal, provincial or state regulations, rules, laws, or local ordinances.</li>
            <li>To infringe upon or violate our intellectual property rights or the intellectual property rights of others.</li>
            <li>To harass, abuse, insult, harm, defame, slander, disparage, intimidate, or discriminate based on gender, sexual orientation, religion, ethnicity, race, age, national origin, or disability.</li>
            <li>To submit false or misleading information.</li>
            <li>To upload or transmit viruses or any other type of malicious code.</li>
            <li>For any obscene or immoral purpose.</li>
            <li>To interfere with or circumvent the security features of the Service.</li>
          </ul>
          <p className="leading-relaxed mt-4">
            We reserve the right to terminate your use of the Service for violating any of the prohibited uses.
          </p>

          <h2 className="text-2xl font-semibold text-white pt-4">4. Disclaimer of Warranties</h2>
          <p className="leading-relaxed">
            The Service is provided on an "AS IS" and "AS AVAILABLE" basis. We make no warranties, 
            expressed or implied, regarding the operation or availability of the Service, or the 
            information, content, or materials included therein. You expressly agree that your use 
            of the Service is at your sole risk.
          </p>

          <h2 className="text-2xl font-semibold text-white pt-4">5. Limitation of Liability</h2>
          <p className="leading-relaxed">
            In no event shall Earthie, nor its creators, be liable for any indirect, incidental, 
            special, consequential or punitive damages, including without limitation, loss of profits, 
            data, use, goodwill, or other intangible losses, resulting from your access to or use of 
            or inability to access or use the Service.
          </p>

          <h2 className="text-2xl font-semibold text-white pt-4">6. AI Limitations</h2>
          <p className="leading-relaxed">
            You acknowledge that Earthie is an AI and may produce inaccurate, incomplete, or 
            offensive information. Verify critical information independently. Responses do not 
            represent the views of the creators or any official entity unless explicitly stated.
          </p>

          <h2 className="text-2xl font-semibold text-white pt-4">7. Changes to Terms</h2>
          <p className="leading-relaxed">
            We reserve the right, at our sole discretion, to modify or replace these Terms at any 
            time. We will try to provide notice prior to any new terms taking effect. What 
            constitutes a material change will be determined at our sole discretion.
          </p>

          <h2 className="text-2xl font-semibold text-white pt-4">8. Governing Law</h2>
          <p className="leading-relaxed">
            These Terms shall be governed and construed in accordance with the laws of 
            [Insert Jurisdiction, e.g., Your State/Country], without regard to its conflict of law provisions.
          </p>

          <h2 className="text-2xl font-semibold text-white pt-4">9. Contact Us</h2>
          <p className="leading-relaxed">
            If you have any questions about these Terms, please contact us at: 
            [Insert Contact Email or Method].
          </p>
        </div>
      </div>
    </div>
  );
} 