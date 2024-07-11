import React from "react";
import { render } from "preact";
import App from "./App";
import "./index.css";

const container = document.getElementById("root");

if (container) {
  render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
    container,
  );
} else {
  throw new Error(
    "Root element with ID 'root' was not found in the document. Ensure there is a corresponding HTML element with the ID 'root' in your HTML file.",
  );
}
