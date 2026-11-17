import { describe, expect, it } from "vitest";
import { mapPayPalEvent, paypalValue, verifyStripeSignature } from "../src/worker/payments";

describe("PayPal events", () =>
{
    it("upgrades on activation using custom_id as the subscriber", () =>
    {
        expect(mapPayPalEvent({ event_type: "BILLING.SUBSCRIPTION.ACTIVATED", resource: { id: "I-1", custom_id: "sub1", plan_id: "P-1", subscriber: { email_address: "A@B.co" } } }))
            .toEqual({ kind: "upgrade", subscriberId: "sub1", subscriptionId: "I-1", planId: "P-1", email: "a@b.co" });
    });

    it("cancels on cancellation and expiry", () =>
    {
        expect(mapPayPalEvent({ event_type: "BILLING.SUBSCRIPTION.CANCELLED", resource: { id: "I-1", custom_id: "sub1" } }).kind).toBe("cancel");
        expect(mapPayPalEvent({ event_type: "BILLING.SUBSCRIPTION.EXPIRED", resource: { id: "I-1" } }).kind).toBe("cancel");
    });

    it("ignores other events and events without a subscription", () =>
    {
        expect(mapPayPalEvent({ event_type: "PAYMENT.SALE.COMPLETED", resource: { id: "X" } }).kind).toBe("ignore");
        expect(mapPayPalEvent({ event_type: "BILLING.SUBSCRIPTION.ACTIVATED", resource: { custom_id: "sub1" } }).kind).toBe("ignore");
    });

    it("formats amounts as decimal strings", () =>
    {
        expect(paypalValue(900)).toBe("9.00");
        expect(paypalValue(12345)).toBe("123.45");
    });
});

describe("Stripe signatures", () =>
{
    it("accepts a valid signature and rejects a tampered body", async () =>
    {
        const secret = "whsec_test";
        const timestamp = Math.floor(Date.now() / 1000);
        const payload = '{"type":"x"}';
        const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
        const signature = [...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`)))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
        expect(await verifyStripeSignature(secret, `t=${timestamp},v1=${signature}`, payload)).toBe(true);
        expect(await verifyStripeSignature(secret, `t=${timestamp},v1=${signature}`, '{"type":"y"}')).toBe(false);
    });
});
