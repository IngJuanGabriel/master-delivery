import React from "react";
import { createRoot } from "react-dom/client";
import AudioLab from "./AudioLab";
import "./styles.css";
createRoot(document.getElementById("root")!).render(<React.StrictMode><AudioLab /></React.StrictMode>);
