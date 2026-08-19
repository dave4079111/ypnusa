"use client";

import { useAgent } from "./useAgent";
import type { GmbDescriptionResult, GmbGoal, GmbPostResult, GmbProfile } from "@/lib/agents/gmbAgent";

export function useGMB() {
  const post = useAgent<GmbPostResult>();
  const description = useAgent<GmbDescriptionResult>();

  return {
    post: {
      ...post,
      generate: (profile: GmbProfile, goal: GmbGoal) => post.run({ type: "gmb-post", profile, goal }),
    },
    description: {
      ...description,
      generate: (profile: GmbProfile) => description.run({ type: "gmb-optimize-description", profile }),
    },
  };
}
