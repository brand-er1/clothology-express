
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Auth from "@/pages/Auth";
import Profile from "@/pages/Profile";
import { AuthGuard } from "@/components/auth/AuthGuard";
import AuthCallback from "@/pages/AuthCallback";
import { WelcomeNotification } from "@/components/WelcomeNotification";

const queryClient = new QueryClient();

function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <WelcomeNotification />
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route
            path="/profile"
            element={
              <AuthGuard>
                <Profile />
              </AuthGuard>
            }
          />
          <Route
            path="/"
            element={
              <AuthGuard>
                <div>Home</div>
              </AuthGuard>
            }
          />
        </Routes>
      </QueryClientProvider>
    </BrowserRouter>
  );
}

export default App;
