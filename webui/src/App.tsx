import { BrowserRouter, Route, Routes } from "react-router";
import StoryListPage from "./pages/StoryListPage";
import EntityRosterPage from "./pages/EntityRosterPage";
import EntityDetailPage from "./pages/EntityDetailPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StoryListPage />} />
        <Route path="/stories/:storyId" element={<EntityRosterPage />} />
        <Route
          path="/stories/:storyId/entities/:memoryId"
          element={<EntityDetailPage />}
        />
      </Routes>
    </BrowserRouter>
  );
}
