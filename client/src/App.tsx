import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import MissionControl from "./pages/MissionControl";
import { SimProvider } from "./sim/SimContext";

function App() {
  return (
    <SimProvider>
      <Router>
        <Routes>
          <Route path="/" element={<MissionControl />} />
          <Route path="/explore" element={<Navigate to="/#live" replace />} />
          <Route path="/mockup" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </SimProvider>
  );
}

export default App;
