"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useMemo } from "react";

export function ConvexClientProvider({ children }) {
  const convex = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) return null;
    return new ConvexReactClient(url);
  }, []);

  if (!convex) {
    return (
      <div className="missing-env">
        <div>
          <p className="eyebrow">Konfiguration fehlt</p>
          <h1>NEXT_PUBLIC_CONVEX_URL ist nicht gesetzt.</h1>
          <p>
            Starte `npx convex dev` und kopiere die URL in `.env.local`, bevor
            die App geladen wird.
          </p>
        </div>
      </div>
    );
  }

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
