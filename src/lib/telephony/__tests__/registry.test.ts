import { describe, it, expect } from "vitest";
import { getTelephonyProvider, listKnownProviders } from "../registry";

describe("telephony registry", () => {
  it("lists the built-in providers", () => {
    const names = listKnownProviders();
    expect(names).toContain("stub");
    expect(names).toContain("twilio");
    expect(names).toContain("vonage");
  });

  it("falls back to the stub for unknown provider names", () => {
    const p = getTelephonyProvider("totally-fake");
    expect(p.name).toBe("stub");
  });

  it("memoizes provider instances by name", () => {
    expect(getTelephonyProvider("stub")).toBe(getTelephonyProvider("stub"));
    expect(getTelephonyProvider("twilio")).toBe(getTelephonyProvider("twilio"));
    expect(getTelephonyProvider("stub")).not.toBe(getTelephonyProvider("twilio"));
  });

  it("stub provider is always configured and reports ok health", async () => {
    const stub = getTelephonyProvider("stub");
    expect(stub.isConfigured()).toBe(true);
    const h = await stub.healthCheck();
    expect(h.ok).toBe(true);
    expect(h.provider).toBe("stub");
  });

  it("twilio provider is unconfigured without env and rejects calls clearly", async () => {
    const t = getTelephonyProvider("twilio");
    const previousSid = process.env.TWILIO_ACCOUNT_SID;
    const previousToken = process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    try {
      expect(t.isConfigured()).toBe(false);
      await expect(
        t.placeCall({ fromNumber: "+1", toNumber: "+2", callId: "c", agentId: "a", recordingEnabled: false }),
      ).rejects.toThrow(/not configured/i);
    } finally {
      if (previousSid) process.env.TWILIO_ACCOUNT_SID = previousSid;
      if (previousToken) process.env.TWILIO_AUTH_TOKEN = previousToken;
    }
  });
});