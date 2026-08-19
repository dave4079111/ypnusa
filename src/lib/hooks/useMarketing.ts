"use client";

import { useAgent } from "./useAgent";
import type { AdCopyResult, EmailResult, MarketingRequest, SocialPostResult } from "@/lib/agents/marketingAgent";

export function useMarketing() {
  const socialPost = useAgent<SocialPostResult>();
  const email = useAgent<EmailResult>();
  const adCopy = useAgent<AdCopyResult>();

  return {
    socialPost: {
      ...socialPost,
      generate: (request: MarketingRequest) => socialPost.run({ type: "marketing-social-post", request }),
    },
    email: {
      ...email,
      generate: (request: MarketingRequest) => email.run({ type: "marketing-email", request }),
    },
    adCopy: {
      ...adCopy,
      generate: (request: MarketingRequest) => adCopy.run({ type: "marketing-ad-copy", request }),
    },
  };
}
