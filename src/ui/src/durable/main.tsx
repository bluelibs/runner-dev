import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RuntimeDashboard } from "./RuntimeDashboard";
import "./overview.css";
import "./inspection.css";
import "./schedule.css";
import "./styles.css";
import "./pagination.css";
import "./runtime.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element.");
createRoot(root).render(
  <StrictMode>
    <RuntimeDashboard />
  </StrictMode>
);
