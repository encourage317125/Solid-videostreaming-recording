import { Routes, Route } from "@solidjs/router"

import styles from './App.module.css';
import RecordDashboard from './pages/Dashboard';
import Login from "./pages/Login";

const App = () => {
  return (
      <Routes>
        <Route path="/dashboard" component={RecordDashboard} />
        <Route path="/" component={Login} />
      </Routes>
  );
};

export default App;
