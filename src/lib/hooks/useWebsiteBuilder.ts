"use client";

import { useAgent } from "./useAgent";
import type { PageSpec } from "@/lib/agents/websiteBuilderAgent";

export function useWebsiteBuilder() {
  const pageSpec = useAgent<PageSpec>();
  const landingPage = useAgent<PageSpec>();

  return {
    pageSpec: {
      ...pageSpec,
      generate: (goal: string, audience: string, sections: string[]) =>
        pageSpec.run({ type: "website-page-spec", goal, audience, sections }),
    },
    landingPage: {
      ...landingPage,
      generate: (goal: string, offer: string) => landingPage.run({ type: "website-landing-page", goal, offer }),
    },
  };
}
