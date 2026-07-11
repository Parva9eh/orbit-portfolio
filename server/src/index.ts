import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import astroRoutes from "./routes/astro.ts";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", astroRoutes);

const PORT = Number(process.env.PORT) || 8000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
