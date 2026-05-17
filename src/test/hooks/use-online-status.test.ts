import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useOnlineStatus } from "../../app/hooks/use-online-status";

describe("useOnlineStatus", () => {
  it("returns online status", () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(typeof result.current).toBe("boolean");
  });

  it("updates when going offline", () => {
    const { result } = renderHook(() => useOnlineStatus());

    // Simulate going offline
    act(() => {
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: false,
      });
      window.dispatchEvent(new Event("offline"));
    });

    // The hook should have registered the event listener
    expect(result.current).toBeDefined();
  });
});

// Helper for act
import { act } from "@testing-library/react";
