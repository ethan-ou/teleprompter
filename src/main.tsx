import React from "react";
import { render } from "preact";

import { Provider } from "react-redux";
import App from "./App";
import { persistor, store } from "./app/store";
import "./reset.css";
import "./index.css";
import { PersistGate } from "redux-persist/integration/react";

const container = document.getElementById("root");

if (container) {
  render(
    <React.StrictMode>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <App />
        </PersistGate>
      </Provider>
    </React.StrictMode>,
    container
  );
} else {
  throw new Error(
    "Root element with ID 'root' was not found in the document. Ensure there is a corresponding HTML element with the ID 'root' in your HTML file."
  );
}
