/**
 * Unit tests for shipment tracking actions and API client.
 */

// Mock external modules before imports
jest.mock("@/lib/auth/session", () => ({
  getSessionUser: jest.fn(),
}));

import { getSessionUser as mockGetSessionUser } from "@/lib/auth/session";
import { getOrderTrackingAction } from "@/lib/actions/account";
import { fetchOrderTracking } from "@/lib/woocommerce/shipping";

describe("Shipping & Tracking Actions", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      MYAPP_CART_AUTH_KEY: "test_secret_key_123",
      NEXT_PUBLIC_WOOCOMMERCE_PROTCOL: "https",
      NEXT_PUBLIC_WOOCOMMERCE_HOST: "trjshop.com",
    };
    global.fetch = jest.fn();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("getOrderTrackingAction", () => {
    it("returns error if user is not authenticated", async () => {
      (mockGetSessionUser as jest.Mock).mockResolvedValue(null);

      const result = await getOrderTrackingAction(1234);

      expect(result.success).toBe(false);
      expect(result.error).toContain("must be signed in");
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("fetches tracking successfully for authenticated user", async () => {
      (mockGetSessionUser as jest.Mock).mockResolvedValue({
        id: "42",
        email: "customer@example.com",
        name: "Test Customer",
      });

      const mockTrackingResponse = {
        success: true,
        has_tracking: true,
        order_id: 1234,
        order_number: "ORD-1234",
        awb: "59629792084",
        status: "In Transit",
        status_id: 6,
        courier: "Delhivery",
        etd: "2026-09-30",
        scans: [
          {
            date: "2026-09-23 14:00:00",
            activity: "Shipment Picked Up",
            location: "Mumbai",
          },
        ],
        updated_at: "2026-09-23 14:05:00",
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockTrackingResponse,
      });

      const result = await getOrderTrackingAction(1234);

      expect(result.success).toBe(true);
      expect(result.tracking).toBeDefined();
      expect(result.tracking?.awb).toBe("59629792084");
      expect(result.tracking?.status).toBe("In Transit");
      expect(result.tracking?.courier).toBe("Delhivery");
      expect(result.tracking?.scans).toHaveLength(1);
      expect(result.tracking?.scans[0].location).toBe("Mumbai");

      // Verify request parameters passed to WordPress endpoint
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain("/wp-json/myapp/v1/shipping/track/1234");
      expect(calledUrl).toContain("AUTH_KEY=test_secret_key_123");
      expect(calledUrl).toContain("user_id=42");
      expect(calledUrl).toContain("email=customer%40example.com");
    });

    it("handles 403 Forbidden properly when user does not own order", async () => {
      (mockGetSessionUser as jest.Mock).mockResolvedValue({
        id: "99",
        email: "stranger@example.com",
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ error: "forbidden" }),
      });

      const result = await getOrderTrackingAction(1234);

      expect(result.success).toBe(false);
      expect(result.error).toContain("do not have permission");
    });
  });

  describe("fetchOrderTracking", () => {
    it("returns error on invalid orderId", async () => {
      const result = await fetchOrderTracking(0, 1, "test@example.com");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid order ID");
    });

    it("returns error if internal AUTH_KEY is missing", async () => {
      delete process.env.MYAPP_CART_AUTH_KEY;
      delete process.env.AUTH_KEY;

      const result = await fetchOrderTracking(1234, 1, "test@example.com");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not configured");
    });

    it("parses empty tracking response for pending fulfillment gracefully", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          has_tracking: false,
          order_id: 1234,
          awb: null,
          status: null,
          courier: null,
          scans: [],
        }),
      });

      const result = await fetchOrderTracking(1234, 1, "test@example.com");

      expect(result.success).toBe(true);
      expect(result.tracking?.hasTracking).toBe(false);
      expect(result.tracking?.awb).toBeNull();
      expect(result.tracking?.scans).toEqual([]);
    });
  });
});
