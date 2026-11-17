import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ConfirmDialogHost } from "./components/ConfirmDialog";
import { ToastHost } from "./components/Toast";
import "./index.css";
import { watchTheme } from "./lib/theme";

watchTheme();

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <App />
        <ConfirmDialogHost />
        <ToastHost />
    </StrictMode>
);
