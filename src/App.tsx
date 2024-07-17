import { Navbar } from "./features/navbar";
import { Content } from "./features/content";
import { Capture } from "./features/capture";
import { Status } from "./features/status";

const App = () => {
  return (
    <div className="app">
      <Status />
      <Navbar />
      <Capture />
      <Content />
    </div>
  );
};

export default App;
