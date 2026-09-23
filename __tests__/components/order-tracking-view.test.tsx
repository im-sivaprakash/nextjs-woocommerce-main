import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OrderTrackingView } from "@/components/account/order-tracking-view";
import { getOrderTrackingAction } from "@/lib/actions/account";

jest.mock("@/lib/actions/account", () => ({
  getOrderTrackingAction: jest.fn(),
}));

describe("OrderTrackingView Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders live tracking details with AWB and scans timeline", async () => {
    (getOrderTrackingAction as jest.Mock).mockResolvedValue({
      success: true,
      tracking: {
        orderId: 101,
        orderNumber: "ORD-101",
        awb: "59629792084",
        status: "In Transit",
        statusId: 6,
        courier: "Delhivery Express",
        etd: "2026-09-30",
        scans: [
          {
            date: "2026-09-23 16:00:00",
            activity: "Out for delivery",
            location: "Bangalore Hub",
          },
          {
            date: "2026-09-22 10:00:00",
            activity: "Package Picked Up",
            location: "Warehouse",
          },
        ],
        updatedAt: "2026-09-23 16:05:00",
        hasTracking: true,
      },
    });

    render(<OrderTrackingView orderId={101} orderNumber="ORD-101" orderStatus="processing" />);

    await waitFor(() => {
      expect(screen.getByText("Shipment Tracking")).toBeInTheDocument();
    });

    expect(screen.getByText("59629792084")).toBeInTheDocument();
    expect(screen.getByText("Delhivery Express")).toBeInTheDocument();
    expect(screen.getByText("Out for delivery")).toBeInTheDocument();
    expect(screen.getByText("Bangalore Hub")).toBeInTheDocument();
    expect(screen.getByText("Package Picked Up")).toBeInTheDocument();
    expect(screen.getByText("Warehouse")).toBeInTheDocument();
  });

  it("renders empty state when tracking information is not yet available", async () => {
    (getOrderTrackingAction as jest.Mock).mockResolvedValue({
      success: true,
      tracking: {
        orderId: 102,
        orderNumber: "ORD-102",
        awb: null,
        status: null,
        courier: null,
        scans: [],
        hasTracking: false,
      },
    });

    render(<OrderTrackingView orderId={102} orderNumber="ORD-102" orderStatus="processing" />);

    await waitFor(() => {
      expect(screen.getByText("Shipment In Preparation")).toBeInTheDocument();
    });

    expect(
      screen.getByText(/currently being prepared for dispatch/i)
    ).toBeInTheDocument();
  });

  it("renders error message and allows retrying", async () => {
    (getOrderTrackingAction as jest.Mock)
      .mockResolvedValueOnce({
        success: false,
        error: "Network error loading tracking",
      })
      .mockResolvedValueOnce({
        success: true,
        tracking: {
          orderId: 103,
          awb: "AWB12345",
          courier: "Blue Dart",
          scans: [],
          hasTracking: true,
        },
      });

    render(<OrderTrackingView orderId={103} orderNumber="ORD-103" />);

    await waitFor(() => {
      expect(screen.getByText("Network error loading tracking")).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole("button", { name: /retry/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText("AWB12345")).toBeInTheDocument();
    });
  });

  it("copies AWB tracking number to clipboard on copy click", async () => {
    const writeTextMock = jest.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    (getOrderTrackingAction as jest.Mock).mockResolvedValue({
      success: true,
      tracking: {
        orderId: 104,
        awb: "9876543210",
        courier: "Blue Dart",
        scans: [],
        hasTracking: true,
      },
    });

    render(<OrderTrackingView orderId={104} />);

    await waitFor(() => {
      expect(screen.getByText("9876543210")).toBeInTheDocument();
    });

    const copyBtn = screen.getByTitle("Copy Tracking Number");
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith("9876543210");
  });
});
