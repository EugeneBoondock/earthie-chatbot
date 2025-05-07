"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { User as UserIcon, Book, Building } from "lucide-react";
import { supabase } from '@/lib/supabase';
import type { User } from "@supabase/supabase-js";
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function HubOverview() {
  const [user, setUser] = useState<User | null>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: import('@supabase/supabase-js').Session | null } }) => {
      setUser(session?.user ?? null);
    });
    // Listen for login/logout
    const { data: listener } = supabase.auth.onAuthStateChange((event: string, session: import('@supabase/supabase-js').Session | null) => {
      setUser(session?.user ?? null);
    });
    return () => listener?.subscription?.unsubscribe();
  }, []);

  const features = [
    {
      title: "Profile",
      description: "View your linked Earth2 profile, manage your properties, and track your net worth.",
      icon: <UserIcon className="h-8 w-8 text-earthie-mint" />,
      link: "/hub/profile",
      gradient: "from-sky-900/60 to-blue-900/50",
      border: "border-sky-400/20",
    },
    {
      title: "E2pedia",
      description: "Browse official Earth2 announcements and access a growing knowledge base.",
      icon: <Book className="h-8 w-8 text-earthie-mint" />,
      link: "/hub/e2pedia",
      gradient: "from-indigo-900/60 to-violet-900/50",
      border: "border-indigo-400/20",
    },
    {
      title: "My Lobbyist",
      description: user
        ? "You are logged in! Join the community, share posts, comment, and react in the Earth2 social hub."
        : "Log in to join the community, share posts, comment, and react in the Earth2 social hub.",
      icon: <Building className="h-8 w-8 text-earthie-mint" />,
      link: "/hub/lobbyist",
      gradient: "from-indigo-900/60 to-purple-900/50",
      border: "border-indigo-400/20",
      highlight: !user,
    },
  ];

  return (
    <section className="mt-16 mb-10 px-4 max-w-5xl mx-auto">
      <div className="backdrop-blur-lg rounded-2xl bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 border border-earthie-mint/30 shadow-xl p-8">
        <h2 className="text-3xl md:text-4xl font-bold text-earthie-mint mb-2 flex items-center gap-3">
          <span className="inline-block bg-gradient-to-r from-earthie-mint to-sky-300 text-transparent bg-clip-text">Discover the Earth2 Hub</span>
        </h2>
        <p className="text-lg text-cyan-200/90 mb-6">
          The Hub is your command center for powerful Earth2 tools and community features:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, idx) => (
            <Link
              href={feature.link}
              key={feature.title}
              className={`relative group p-6 rounded-xl bg-gradient-to-br ${feature.gradient} ${feature.border} shadow transition-all duration-300 flex flex-col h-full overflow-hidden ${feature.highlight ? "ring-2 ring-rose-400/40" : ""}`}
              style={{ minHeight: "180px" }}
            >
              <div className="mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold text-white mb-1 flex items-center gap-2">
                {feature.title}
                {feature.highlight && (
                  <span className="ml-2 px-2 py-0.5 text-xs rounded bg-rose-500/80 text-white animate-pulse">Login Required</span>
                )}
              </h3>
              <p className="text-cyan-200/80 flex-1">{feature.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
