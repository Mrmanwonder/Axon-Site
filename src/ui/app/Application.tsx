import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
export default function Application() {
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    const install = () => { void navigator.serviceWorker.register("/sw.js").catch(error => console.error("Offline shell could not be installed", error)); };
    if (document.readyState === "complete") install();
    else window.addEventListener("load", install, { once: true });
    return () => window.removeEventListener("load", install);
  }, []);
  return <RouterProvider router={router} />;
}
