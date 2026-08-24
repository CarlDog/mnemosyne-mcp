import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Self-hosted font packages -- no external Google Fonts request at
// runtime. One weight range per face is enough; body/display swap
// between regular and a couple of heavier cuts via CSS font-weight.
import "@fontsource/fraunces/400.css";
import "@fontsource/fraunces/500.css";
import "@fontsource/fraunces/600-italic.css";
import "@fontsource/fraunces/700.css";
import "@fontsource/literata/400.css";
import "@fontsource/literata/400-italic.css";
import "@fontsource/literata/500.css";
import "@fontsource/courier-prime/400.css";
import "@fontsource/courier-prime/700.css";

import "./styles/global.css";

import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
