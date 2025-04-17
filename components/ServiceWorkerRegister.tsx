"use client";
import { useEffect } from "react";
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("public/sw.js");
    }
  }, []);
  return null;
}
