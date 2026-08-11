import "./bootstrap-share-intent";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { registerPwaServiceWorker } from "./services/pwa";
import { isWeb, tdApp } from "./utils";
import "./i18n";
import "./globals.css";
import { BrowserRouter } from "react-router-dom";
tdApp.init();
if (isWeb) registerPwaServiceWorker();

const application = (
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
const shouldUseStrictMode = isWeb || import.meta.env.PROD;

createRoot(document.getElementById("root") as HTMLElement).render(
  shouldUseStrictMode ? <StrictMode>{application}</StrictMode> : application,
);
