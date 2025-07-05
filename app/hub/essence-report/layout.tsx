import React from "react";
import ComingSoon from "./coming-soon";

export default function EssenceReportLayout({ children }: { children: React.ReactNode }) {
  // Always render ComingSoon, hiding the real content
  return <ComingSoon />;
} 