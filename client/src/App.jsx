import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import MissionControl from "./pages/MissionControl.jsx";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MissionControl />} />
        {/* Legacy routes redirect into the mission shell */}
        <Route path="/explore" element={<Navigate to="/#live" replace />} />
        <Route path="/mockup" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
