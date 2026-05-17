import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { describe, expect, it } from "vitest";
import {
  CountUp,
  FadeInOnScroll,
  HoverScale,
  PageTransition,
  PulseGlow,
  StaggerContainer,
  StaggerItem,
} from "../../app/components/animations/page-transition";

describe("Animation Components", () => {
  describe("PageTransition", () => {
    it("renders children with fade mode", () => {
      render(
        <BrowserRouter>
          <PageTransition mode="fade">
            <div data-testid="content">Page Content</div>
          </PageTransition>
        </BrowserRouter>
      );
      expect(screen.getByTestId("content")).toBeInTheDocument();
    });

    it("renders children with slide mode", () => {
      render(
        <BrowserRouter>
          <PageTransition mode="slide">
            <div data-testid="content">Page Content</div>
          </PageTransition>
        </BrowserRouter>
      );
      expect(screen.getByTestId("content")).toBeInTheDocument();
    });

    it("renders children with slideUp mode", () => {
      render(
        <BrowserRouter>
          <PageTransition mode="slideUp">
            <div data-testid="content">Page Content</div>
          </PageTransition>
        </BrowserRouter>
      );
      expect(screen.getByTestId("content")).toBeInTheDocument();
    });

    it("renders children with scale mode", () => {
      render(
        <BrowserRouter>
          <PageTransition mode="scale">
            <div data-testid="content">Page Content</div>
          </PageTransition>
        </BrowserRouter>
      );
      expect(screen.getByTestId("content")).toBeInTheDocument();
    });
  });

  describe("StaggerContainer & StaggerItem", () => {
    it("renders staggered children", () => {
      render(
        <StaggerContainer data-testid="container">
          <StaggerItem>
            <div>Item 1</div>
          </StaggerItem>
          <StaggerItem>
            <div>Item 2</div>
          </StaggerItem>
          <StaggerItem>
            <div>Item 3</div>
          </StaggerItem>
        </StaggerContainer>
      );
      expect(screen.getByText("Item 1")).toBeInTheDocument();
      expect(screen.getByText("Item 2")).toBeInTheDocument();
      expect(screen.getByText("Item 3")).toBeInTheDocument();
    });

    it("renders with custom stagger delay", () => {
      render(
        <StaggerContainer staggerDelay={0.1}>
          <StaggerItem>
            <div>Item</div>
          </StaggerItem>
        </StaggerContainer>
      );
      expect(screen.getByText("Item")).toBeInTheDocument();
    });
  });

  describe("HoverScale", () => {
    it("renders children", () => {
      render(
        <HoverScale data-testid="hover">
          <div>Hover Content</div>
        </HoverScale>
      );
      expect(screen.getByText("Hover Content")).toBeInTheDocument();
    });

    it("renders with custom scale", () => {
      render(
        <HoverScale scale={1.05}>
          <div>Scaled Content</div>
        </HoverScale>
      );
      expect(screen.getByText("Scaled Content")).toBeInTheDocument();
    });
  });

  describe("FadeInOnScroll", () => {
    it("renders children", () => {
      render(
        <FadeInOnScroll data-testid="fade">
          <div>Fade Content</div>
        </FadeInOnScroll>
      );
      expect(screen.getByText("Fade Content")).toBeInTheDocument();
    });

    it("renders with custom delay", () => {
      render(
        <FadeInOnScroll delay={0.2}>
          <div>Delayed Content</div>
        </FadeInOnScroll>
      );
      expect(screen.getByText("Delayed Content")).toBeInTheDocument();
    });
  });

  describe("PulseGlow", () => {
    it("renders children", () => {
      render(
        <PulseGlow data-testid="pulse">
          <div>Pulse Content</div>
        </PulseGlow>
      );
      expect(screen.getByText("Pulse Content")).toBeInTheDocument();
    });

    it("renders with custom color", () => {
      render(
        <PulseGlow color="rgba(255, 0, 0, 0.4)">
          <div>Colored Pulse</div>
        </PulseGlow>
      );
      expect(screen.getByText("Colored Pulse")).toBeInTheDocument();
    });
  });

  describe("CountUp", () => {
    it("renders with end value", () => {
      const { container } = render(<CountUp end={100} />);
      expect(container.querySelector("span")).toBeInTheDocument();
    });

    it("renders with prefix and suffix", () => {
      const { container } = render(<CountUp end={1000} prefix="$" suffix="+" />);
      const span = container.querySelector("span");
      expect(span).toBeInTheDocument();
    });

    it("renders with custom duration", () => {
      const { container } = render(<CountUp end={500} duration={2} />);
      expect(container.querySelector("span")).toBeInTheDocument();
    });
  });
});
