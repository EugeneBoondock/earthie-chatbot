import { ArrowRight, Book, Building, BarChart3, User } from 'lucide-react';
import Link from 'next/link';

export default function HubPage() {
  const hubFeatures = [
    {
      title: "Profile",
      description: "View your linked Earth2 profile and properties",
      icon: <User className="h-8 w-8 text-earthie-mint" />,
      link: "/hub/profile",
      gradient: "from-sky-900/50 to-blue-900/50",
      borderColor: "border-sky-400/30"
    },
    {
      title: "E2pedia",
      description: "Access Earth2 announcements and knowledge base",
      icon: <Book className="h-8 w-8 text-earthie-mint" />,
      link: "/hub/e2pedia",
      gradient: "from-indigo-900/50 to-violet-900/50",
      borderColor: "border-indigo-400/30"
    },
    {
      title: "My Lobbyist",
      description: "Join the community, share posts, comment, and react in the Earth2 social hub.",
      icon: <Building className="h-8 w-8 text-earthie-mint" />,
      link: "/hub/lobbyist",
      gradient: "from-indigo-900/50 to-purple-900/50",
      borderColor: "border-indigo-400/30"
    },
    {
      title: "Essence Tracker",
      description: "Track Essence price, wallet, and analytics",
      icon: <BarChart3 className="h-8 w-8 text-earthie-mint" />,
      link: "/hub/essence",
      gradient: "from-teal-800/50 to-cyan-800/50",
      borderColor: "border-teal-400/30"
    }
  ];

  return (
    <div className="space-y-10">
      {/* Hero Section with Glassmorphic Effect */}
      <div className="relative overflow-hidden rounded-2xl p-8 backdrop-blur-lg bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 border border-earthie-mint/30 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 to-cyan-500/5 z-0"></div>
        <div className="relative z-10 text-center space-y-4">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-earthie-mint to-sky-300 inline-block text-transparent bg-clip-text mb-4">
            Welcome to The Hub
          </h1>
          <p className="text-xl text-cyan-200/90 max-w-2xl mx-auto">
            Your central arena for Earth2 tools and information, designed to enhance your Earth2 experience.
          </p>
        </div>
        
        {/* Decorative Elements */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-earthie-mint/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-sky-400/10 rounded-full blur-3xl"></div>
      </div>

      {/* Features Grid with Glassmorphic Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
        {hubFeatures.map((feature, index) => (
          <Link 
            href={feature.link} 
            key={index} 
            className="group relative flex flex-col p-6 h-full backdrop-blur-md bg-gradient-to-br border rounded-xl shadow-lg transition-all duration-300 ease-in-out hover:shadow-earthie-mint/20 hover:-translate-y-1 overflow-hidden"
            style={{
              backgroundImage: `linear-gradient(to bottom right, rgba(47, 46, 61, 0.7), rgba(63, 62, 77, 0.5))`,
            }}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-30 group-hover:opacity-40 transition-opacity`}></div>
            <div className={`absolute inset-0 border rounded-xl ${feature.borderColor} opacity-60 group-hover:opacity-100 transition-opacity`}></div>
            
            <div className="relative z-10 flex-1 flex flex-col">
              <div className="mb-4">{feature.icon}</div>
              <h2 className="text-2xl font-bold text-white mb-2">{feature.title}</h2>
              <p className="text-cyan-200/80 mb-4 flex-grow">{feature.description}</p>
              <div className="flex items-center text-earthie-mint group-hover:text-white transition-colors mt-auto">
                <span className="text-sm font-medium">Explore</span>
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Activity Section */}
      <div className="backdrop-blur-md bg-gradient-to-br from-earthie-dark/70 to-earthie-dark-light/60 border border-sky-400/20 rounded-xl p-6 shadow-lg mt-8">
        <h2 className="text-2xl font-bold text-earthie-mint mb-4">Latest Platform Updates</h2>
        <p className="text-cyan-200/90">
          Stay informed about the newest features and improvements to enhance your Earth2 experience.
        </p>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sky-300/80 text-sm">Updates are synchronized with Earth2's official announcements</span>
          <Building className="h-5 w-5 text-earthie-mint" />
        </div>
      </div>
    </div>
  );
}