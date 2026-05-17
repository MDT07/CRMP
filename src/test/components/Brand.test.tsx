import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandAnimated, BrandLockup, BrandMark, BrandText } from "../../app/components/Brand";

describe("Brand Components", () => {
  describe("BrandMark", () => {
    it("renders with default size", () => {
      render(<BrandMark data-testid="brand-mark" />);
      expect(screen.getByTestId("brand-mark")).toBeInTheDocument();
    });

    it("renders with different sizes", () => {
      const { rerender } = render(<BrandMark size="sm" data-testid="brand-mark" />);
      expect(screen.getByTestId("brand-mark")).toBeInTheDocument();

      rerender(<BrandMark size="lg" data-testid="brand-mark" />);
      expect(screen.getByTestId("brand-mark")).toBeInTheDocument();

      rerender(<BrandMark size="xl" data-testid="brand-mark" />);
      expect(screen.getByTestId("brand-mark")).toBeInTheDocument();
    });

    it("renders with gradient variant", () => {
      render(<BrandMark variant="gradient" data-testid="brand-mark" />);
      expect(screen.getByTestId("brand-mark")).toBeInTheDocument();
    });

    it("renders with minimal variant", () => {
      render(<BrandMark variant="minimal" data-testid="brand-mark" />);
      expect(screen.getByTestId("brand-mark")).toBeInTheDocument();
    });
  });

  describe("BrandLockup", () => {
    it("renders with default props", () => {
      render(<BrandLockup data-testid="brand-lockup" />);
      expect(screen.getByText("CRMP")).toBeInTheDocument();
      expect(screen.getByText("Pipeline Intelligence")).toBeInTheDocument();
    });

    it("renders with custom subtitle", () => {
      render(<BrandLockup subtitle="Custom Subtitle" />);
      expect(screen.getByText("Custom Subtitle")).toBeInTheDocument();
    });

    it("hides subtitle when showSubtitle is false", () => {
      render(<BrandLockup showSubtitle={false} />);
      expect(screen.queryByText("Pipeline Intelligence")).not.toBeInTheDocument();
    });

    it("renders with gradient variant", () => {
      render(<BrandLockup variant="gradient" />);
      expect(screen.getByText("CRMP")).toBeInTheDocument();
    });
  });

  describe("BrandText", () => {
    it("renders with default variant", () => {
      render(<BrandText />);
      expect(screen.getByText("CRMP")).toBeInTheDocument();
    });

    it("renders with muted variant", () => {
      render(<BrandText variant="muted" />);
      expect(screen.getByText("CRMP")).toBeInTheDocument();
    });

    it("renders with gradient variant", () => {
      render(<BrandText variant="gradient" />);
      expect(screen.getByText("CRMP")).toBeInTheDocument();
    });
  });

  describe("BrandAnimated", () => {
    it("renders with default size", () => {
      render(<BrandAnimated data-testid="brand-animated" />);
      expect(screen.getByTestId("brand-animated")).toBeInTheDocument();
    });

    it("renders with different sizes", () => {
      render(<BrandAnimated size="sm" data-testid="brand-animated" />);
      expect(screen.getByTestId("brand-animated")).toBeInTheDocument();
    });
  });
});
