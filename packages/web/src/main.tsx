// Vite React entry — mounts the analytics dashboard.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./theme/tokens.css";
import "./styles.css";

const rootEl = document.getElementById("root");
if (rootEl === null) {
  throw new Error("#root element missing");
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
