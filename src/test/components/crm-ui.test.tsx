import { render, screen } from "@testing-library/react";
import { TrendingUp } from "lucide-react";
import { describe, expect, it } from "vitest";
import { MetricCard } from "../../app/components/crm-ui/metric-card";
import { PageHeader } from "../../app/components/crm-ui/page-header";
import { StatusBadge } from "../../app/components/crm-ui/status-badge";
import { SurfaceCard } from "../../app/components/crm-ui/surface-card";

describe("CRM UI Components", () => {
  describe("MetricCard", () => {
    it("renders with required props", () => {
      render(<MetricCard title="Revenue" value="$100K" />);
      expect(screen.getByText("Revenue")).toBeInTheDocument();
      expect(screen.getByText("$100K")).toBeInTheDocument();
    });

    it("renders with trend indicator", () => {
      render(<MetricCard title="Revenue" value="$100K" trend="up" trendValue="+12%" />);
      expect(screen.getByText("+12%")).toBeInTheDocument();
    });

    it("renders with icon as React element", () => {
      render(<MetricCard title="Revenue" value="$100K" icon={<TrendingUp className="size-5" />} />);
      expect(screen.getByText("Revenue")).toBeInTheDocument();
    });

    it("renders with icon as component", () => {
      render(<MetricCard title="Revenue" value="$100K" icon={TrendingUp} />);
      expect(screen.getByText("Revenue")).toBeInTheDocument();
    });

    it("renders with subtitle", () => {
      render(<MetricCard title="Revenue" value="$100K" subtitle="Monthly target" />);
      expect(screen.getByText("Monthly target")).toBeInTheDocument();
    });

    it("renders with different colors", () => {
      const colors = ["primary", "success", "warning", "info", "accent", "neutral"] as const;
      const { rerender } = render(<MetricCard title="Test" value="100" color="primary" />);

      colors.forEach((color) => {
        rerender(<MetricCard title="Test" value="100" color={color} />);
        expect(screen.getByText("Test")).toBeInTheDocument();
      });
    });

    it("renders with different sizes", () => {
      const { rerender } = render(<MetricCard title="Test" value="100" size="sm" />);
      expect(screen.getByText("Test")).toBeInTheDocument();

      rerender(<MetricCard title="Test" value="100" size="lg" />);
      expect(screen.getByText("Test")).toBeInTheDocument();
    });
  });

  describe("StatusBadge", () => {
    it("renders with default tone", () => {
      render(<StatusBadge>Default</StatusBadge>);
      expect(screen.getByText("Default")).toBeInTheDocument();
    });

    it("renders with different tones", () => {
      const tones = [
        "neutral",
        "primary",
        "success",
        "info",
        "warning",
        "danger",
        "accent",
      ] as const;
      const { rerender } = render(<StatusBadge tone="neutral">Test</StatusBadge>);

      tones.forEach((tone) => {
        rerender(<StatusBadge tone={tone}>Test</StatusBadge>);
        expect(screen.getByText("Test")).toBeInTheDocument();
      });
    });

    it("renders with dot indicator", () => {
      render(
        <StatusBadge tone="success" dot>
          Active
        </StatusBadge>
      );
      expect(screen.getByText("Active")).toBeInTheDocument();
    });

    it("renders with pulse animation", () => {
      render(
        <StatusBadge tone="success" dot pulse>
          Syncing
        </StatusBadge>
      );
      expect(screen.getByText("Syncing")).toBeInTheDocument();
    });

    it("renders with different sizes", () => {
      const { rerender } = render(<StatusBadge size="sm">Small</StatusBadge>);
      expect(screen.getByText("Small")).toBeInTheDocument();

      rerender(<StatusBadge size="lg">Large</StatusBadge>);
      expect(screen.getByText("Large")).toBeInTheDocument();
    });
  });

  describe("SurfaceCard", () => {
    it("renders with default props", () => {
      render(<SurfaceCard data-testid="card">Content</SurfaceCard>);
      expect(screen.getByTestId("card")).toBeInTheDocument();
      expect(screen.getByText("Content")).toBeInTheDocument();
    });

    it("renders with different tones", () => {
      const tones = ["default", "subtle", "accent", "elevated", "glass", "gradient"] as const;
      const { rerender } = render(
        <SurfaceCard tone="default" data-testid="card">
          Test
        </SurfaceCard>
      );

      tones.forEach((tone) => {
        rerender(
          <SurfaceCard tone={tone} data-testid="card">
            Test
          </SurfaceCard>
        );
        expect(screen.getByTestId("card")).toBeInTheDocument();
      });
    });

    it("renders with header", () => {
      render(
        <SurfaceCard header={<div>Header Content</div>} data-testid="card">
          Body Content
        </SurfaceCard>
      );
      expect(screen.getByText("Header Content")).toBeInTheDocument();
      expect(screen.getByText("Body Content")).toBeInTheDocument();
    });

    it("renders with footer", () => {
      render(
        <SurfaceCard footer={<div>Footer Content</div>} data-testid="card">
          Body Content
        </SurfaceCard>
      );
      expect(screen.getByText("Footer Content")).toBeInTheDocument();
      expect(screen.getByText("Body Content")).toBeInTheDocument();
    });

    it("renders with glow effect", () => {
      const glows = ["none", "primary", "success", "warning", "accent"] as const;
      const { rerender } = render(
        <SurfaceCard glow="none" data-testid="card">
          Test
        </SurfaceCard>
      );

      glows.forEach((glow) => {
        rerender(
          <SurfaceCard glow={glow} data-testid="card">
            Test
          </SurfaceCard>
        );
        expect(screen.getByTestId("card")).toBeInTheDocument();
      });
    });

    it("handles interactive mode", () => {
      render(
        <SurfaceCard interactive data-testid="card">
          Clickable
        </SurfaceCard>
      );
      expect(screen.getByTestId("card")).toBeInTheDocument();
    });
  });

  describe("PageHeader", () => {
    it("renders with title and description", () => {
      render(<PageHeader title="Dashboard" description="Overview of your CRM" />);
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
      expect(screen.getByText("Overview of your CRM")).toBeInTheDocument();
    });

    it("renders with meta content", () => {
      render(<PageHeader title="Dashboard" description="Overview" meta={<span>Meta Info</span>} />);
      expect(screen.getByText("Meta Info")).toBeInTheDocument();
    });

    it("renders with actions", () => {
      render(
        <PageHeader
          title="Dashboard"
          description="Overview"
          actions={<button type="button">Action</button>}
        />
      );
      expect(screen.getByText("Action")).toBeInTheDocument();
    });

    it("renders with icon", () => {
      render(
        <PageHeader
          title="Dashboard"
          description="Overview"
          icon={<TrendingUp data-testid="header-icon" />}
        />
      );
      expect(screen.getByTestId("header-icon")).toBeInTheDocument();
    });

    it("renders in compact mode", () => {
      render(<PageHeader title="Dashboard" description="Overview" compact />);
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
    });

    it("renders with badge", () => {
      render(<PageHeader title="Dashboard" description="Overview" badge={<span>Badge</span>} />);
      expect(screen.getByText("Badge")).toBeInTheDocument();
    });
  });
});
