
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { AuthGuard } from "@/components/auth/AuthGuard";
import Index from "@/pages/Index";
import Auth from "@/pages/Auth";
import Admin from "@/pages/Admin";
import Orders from "@/pages/Orders";
import Customize from "@/pages/Customize";
import NotFound from "@/pages/NotFound";
import Profile from "@/pages/Profile";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route
          path="/admin"
          element={
            <AuthGuard>
              <Admin />
            </AuthGuard>
          }
        />
        <Route
          path="/orders"
          element={
            <AuthGuard>
              <Orders />
            </AuthGuard>
          }
        />
        <Route
          path="/customize"
          element={
            <AuthGuard>
              <Customize />
            </AuthGuard>
          }
        />
        <Route
          path="/profile"
          element={
            <AuthGuard>
              <Profile />
            </AuthGuard>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </Router>
  );
}

export default App;
