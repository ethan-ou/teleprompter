import { Navbar } from "./features/navbar";
import { Content } from "./features/content";
import { Capture } from "./features/capture";
import { Status } from "./features/status";
import { Collaborate } from "./features/collaborate";
import { isMobileOrTablet } from "./lib/device";

const mobileOrTablet = isMobileOrTablet();
console.log(mobileOrTablet);
const App = () => {
  return (
    <div className="app">
      <Status />
      <Navbar />
      {!mobileOrTablet && <Capture />}
      <Content />
      <Collaborate />
    </div>
  );
};

export default App;
