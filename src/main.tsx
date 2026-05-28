import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import "./i18n/config";
import "./styles/globals.css";
import { ThemeProvider } from "./theme/ThemeProvider";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
