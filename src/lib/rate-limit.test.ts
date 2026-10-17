import { afterEach, describe, expect, it } from "vitest";
import {
  GLOBAL_RATE_LIMIT_MAX,
  RATE_LIMIT_MAX,
  checkRateLimit,
  clientIp,
  resetRateLimits,
} from "./rate-limit";

afterEach(() => {
  resetRateLimits();
});

describe("rate limit", () => {
  it("allows a burst and then asks the same IP to wait", () => {
    for (let count = 0; count < RATE_LIMIT_MAX; count += 1) {
      expect(checkRateLimit("203.0.113.8", 1_000 + count).ok).toBe(true);
    }
    const blocked = checkRateLimit("203.0.113.8", 1_000 + RATE_LIMIT_MAX);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.scope).toBe("ip");
    expect(checkRateLimit("203.0.113.9", 1_000 + RATE_LIMIT_MAX).ok).toBe(true);
  });

  it("caps the whole process", () => {
    for (let count = 0; count < GLOBAL_RATE_LIMIT_MAX; count += 1) {
      expect(checkRateLimit(`198.51.100.${count}`, 5_000 + count).ok).toBe(true);
    }
    const blocked = checkRateLimit("203.0.113.50", 5_000 + GLOBAL_RATE_LIMIT_MAX);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.scope).toBe("global");
  });

  it("reads the first forwarded address", () => {
    const request = new Request("http://localhost/api/generate", {
      headers: { "x-forwarded-for": "203.0.113.4, 10.0.0.1" },
    });
    expect(clientIp(request)).toBe("203.0.113.4");
  });
});
