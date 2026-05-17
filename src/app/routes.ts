import { lazy } from "react";
import { createHashRouter } from "react-router";
import { AppRouteErrorBoundary } from "./components/AppRouteErrorBoundary";
import { AuthRoute, ProtectedCrmRoute } from "./components/route-gates";
import { Layout } from "./components/Layout";
const Dashboard = lazy(() =>
  import("./components/Dashboard").then((module) => ({ default: module.Dashboard }))
);
const ClientsPage = lazy(() =>
  import("./components/pages/ClientsPage").then((module) => ({ default: module.ClientsPage }))
);
const AccountsPage = lazy(() =>
  import("./components/pages/AccountsPage").then((module) => ({ default: module.AccountsPage }))
);
const PipelinePage = lazy(() =>
  import("./components/pages/PipelinePage").then((module) => ({ default: module.PipelinePage }))
);
const ProjectsPage = lazy(() =>
  import("./components/pages/ProjectsPage").then((module) => ({ default: module.ProjectsPage }))
);
const MessagesPage = lazy(() =>
  import("./components/pages/MessagesPage").then((module) => ({ default: module.MessagesPage }))
);
const TasksPage = lazy(() =>
  import("./components/pages/TasksPage").then((module) => ({ default: module.TasksPage }))
);
const AutomationsPage = lazy(() =>
  import("./components/pages/AutomationsPage").then((module) => ({
    default: module.AutomationsPage,
  }))
);
const AnalyticsPage = lazy(() =>
  import("./components/pages/AnalyticsPage").then((module) => ({ default: module.AnalyticsPage }))
);
const ForecastPage = lazy(() =>
  import("./components/pages/ForecastPage").then((module) => ({ default: module.ForecastPage }))
);
const CampaignsPage = lazy(() =>
  import("./components/pages/CampaignsPage").then((module) => ({ default: module.CampaignsPage }))
);
const ServicePage = lazy(() =>
  import("./components/pages/ServicePage").then((module) => ({ default: module.ServicePage }))
);

const AuthPage = lazy(() =>
  import("./components/pages/AuthPage").then((module) => ({ default: module.AuthPage }))
);
const SettingsPage = lazy(() =>
  import("./components/pages/SettingsPage").then((module) => ({ default: module.SettingsPage }))
);
const NotFoundPage = lazy(() =>
  import("./components/pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage }))
);
export const router = createHashRouter([
  {
    Component: AuthRoute,
    ErrorBoundary: AppRouteErrorBoundary,
    children: [{ path: "/auth", Component: AuthPage }],
  },
  {
    Component: ProtectedCrmRoute,
    ErrorBoundary: AppRouteErrorBoundary,
    children: [
      {
        path: "/",
        Component: Layout,
        ErrorBoundary: AppRouteErrorBoundary,
        children: [
          { index: true, Component: Dashboard },
          { path: "clients", Component: ClientsPage },
          { path: "accounts", Component: AccountsPage },
          { path: "pipeline", Component: PipelinePage },
          { path: "projects", Component: ProjectsPage },
          { path: "messages", Component: MessagesPage },
          { path: "tasks", Component: TasksPage },
          { path: "automations", Component: AutomationsPage },
          { path: "campaigns", Component: CampaignsPage },
          { path: "forecast", Component: ForecastPage },
          { path: "analytics", Component: AnalyticsPage },
          { path: "service", Component: ServicePage },

          { path: "settings", Component: SettingsPage },
          { path: "*", Component: NotFoundPage },
        ],
      },
    ],
  },
]);
