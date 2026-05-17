import { type RenderOptions, render as rtlRender } from "@testing-library/react";
import type React from "react";
import { BrowserRouter } from "react-router";

interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  withRouter?: boolean;
  initialRoute?: string;
}

function AllTheProviders({
  children,
  withRouter = true,
}: {
  children: React.ReactNode;
  withRouter?: boolean;
}) {
  if (withRouter) {
    return <BrowserRouter>{children}</BrowserRouter>;
  }
  return <>{children}</>;
}

export function customRender(ui: React.ReactElement, options: CustomRenderOptions = {}) {
  const { withRouter = true, ...renderOptions } = options;

  return rtlRender(ui, {
    wrapper: (props) => <AllTheProviders {...props} withRouter={withRouter} />,
    ...renderOptions,
  });
}

export * from "@testing-library/react";
export { customRender as render };
