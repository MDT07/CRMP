import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("CRMP Test Suite", () => {
  it("should have testing environment configured", () => {
    expect(true).toBe(true);
  });

  it("should render basic HTML", () => {
    render(<div>CRMP by EmirCo</div>);
    expect(screen.getByText("CRMP by EmirCo")).toBeInTheDocument();
  });
});
