/** React entry point that mounts the Auto-Writer frontend application. */
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HeroUIProvider } from "@heroui/react";
import App from "./App";
import { AppProvider } from "./context/AppContext";
import { AssistantProvider } from "./context/AssistantContext";
import { ToastProvider } from "./components/Toast";
import "./i18n";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <HeroUIProvider>
        <AppProvider>
          <AssistantProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </AssistantProvider>
        </AppProvider>
      </HeroUIProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
