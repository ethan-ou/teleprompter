import { Navbar } from "./features/navbar";
import { Content } from "./features/content";
import { Capture } from "./features/capture";
import { useRef, useState } from "react";
import { useDebounceCallback, useResizeObserver } from "usehooks-ts";

const App = () => {
  return (
    <div className="app">
      <Navbar />
      <Capture />
      <Content />
    </div>
  );
};

export default App;
