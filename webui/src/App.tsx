import { useEffect, useRef } from "react";
import {
  createBrowserRouter,
  Outlet,
  RouterProvider,
  useLocation,
} from "react-router";
import StoryListPage from "./pages/StoryListPage";
import EntityRosterPage from "./pages/EntityRosterPage";
import EntityDetailPage from "./pages/EntityDetailPage";
import ContinueScenePage from "./pages/ContinueScenePage";
import { ThemeProvider } from "./components/ThemeProvider";

function RouteFocusBoundary() {
  const location = useLocation();
  const previousKey = useRef(location.key);

  useEffect(() => {
    if (previousKey.current === location.key) return;
    previousKey.current = location.key;
    window.requestAnimationFrame(() => {
      const main = document.getElementById("workspace-main");
      const target = main?.querySelector<HTMLElement>("h1") ?? main;
      if (!target) return;
      target.tabIndex = -1;
      target.focus();
    });
  }, [location.key]);

  return <Outlet />;
}

const router = createBrowserRouter([
  {
    element: <RouteFocusBoundary />,
    children: [
      { index: true, element: <StoryListPage /> },
      { path: "stories/:storyId", element: <EntityRosterPage /> },
      {
        path: "stories/:storyId/continue",
        element: <ContinueScenePage />,
      },
      {
        path: "stories/:storyId/entities/:memoryId",
        element: <EntityDetailPage />,
      },
    ],
  },
]);

export default function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}
