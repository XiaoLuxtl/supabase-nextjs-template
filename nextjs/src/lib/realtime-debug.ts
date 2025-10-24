// src/lib/realtime-debug.ts
export function setupCreditsDebugging() {
  // Listen to custom events for debugging
  window.addEventListener("credits:updated", ((event: CustomEvent) => {
    console.log("🔔 Credits updated event:", event.detail);
  }) as EventListener);

  // Log subscription status
  const originalConsoleLog = console.log;
  console.log = (...args) => {
    if (args[0]?.includes?.("subscription") || args[0]?.includes?.("credits")) {
      originalConsoleLog("🔍 [Credits Debug]:", ...args);
    } else {
      originalConsoleLog(...args);
    }
  };
}

// Llamar en tu app principal
// setupCreditsDebugging();
