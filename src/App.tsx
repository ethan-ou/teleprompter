import { Navbar } from "./features/navbar";
import { Content } from "./features/content";
import { Capture } from "./features/capture";

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
