import { Navbar } from "./features/navbar";
import { Content } from "./features/content";
import { Capture } from "./features/capture";
import { Status } from "./features/status";
import { isMobileOrTablet } from "./lib/device";

const mobileOrTablet = isMobileOrTablet();

const App = () => {
  return (
    <div className="app">
      <Status />
      <Navbar />
      {!mobileOrTablet && <Capture />}
      <Content />
    </div>
  );
};

export default App;
