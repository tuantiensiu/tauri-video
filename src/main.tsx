import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

const registerServiceWorker = async () => {
  console.log("[App] Registering service worker");

  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.register(
        new URL("./service-workers/service-worker.ts", import.meta.url),
        {
          type: "module",
        }
      ); // register SW with typescript
      registration.addEventListener("updatefound", () => {
        const newWorker: any = registration.installing;
        console.log("[App] New service worker update found");

        newWorker.onstatechange = () => {
          console.log("[App] Service worker state change:", newWorker.state);
          if (newWorker.state === "activated") {
            console.log("[App] Service worker activated");
            // Reload the page to start using the new service worker immediately
            // window.location.reload();
          }
        };
      });
    } catch (error) {
      console.error("[App] Service worker registration failed", error);
    }
    await navigator.serviceWorker.ready;
  } else {
    console.error(
      "[App] Service Worker API is not supported in current browser"
    );
  }
};

registerServiceWorker();
