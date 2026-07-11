import { useApiData } from "../hooks/useApiData";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import ThreeDScene from "../components/ThreeDScene-ok";

function Dashboard() {
  const { data: asteroids } = useApiData("/asteroids?..."); // Reuse
  const { data: planets } = useApiData("/planets"); // Add planet positions

  // Transform for 2D chart (e.g., NEO count over time)
  const chartData = []; /* Process asteroids to [{ date, count }] */

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      <div className="col-span-1 lg:col-span-2 h-96 bg-gray-900 rounded-lg">
        <ThreeDScene asteroids={asteroids} planets={planets} /> // Enhanced with
        planets
      </div>
      <div className="h-96 bg-gray-900 rounded-lg p-4">
        <h3 className="text-lg text-white">NEO Count Trend</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#8884d8" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* Add more panels: Moon phase image, APOD embed, exoplanet stats */}
    </div>
  );
}

export default Dashboard;
