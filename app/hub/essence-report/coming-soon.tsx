import React from "react";

export default function ComingSoon() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-gradient-to-br from-slate-50/50 to-blue-50/50 dark:from-slate-900/50 dark:to-slate-800/50 backdrop-blur-sm">
      <div className="bg-white/20 dark:bg-slate-800/20 backdrop-blur-md border border-white/30 dark:border-slate-700/30 rounded-2xl px-12 py-8 shadow-xl">
        <h1 className="text-4xl font-light text-gray-800 dark:text-gray-200 text-center">
          Coming Soon
        </h1>
      </div>
    </div>
  );
} 