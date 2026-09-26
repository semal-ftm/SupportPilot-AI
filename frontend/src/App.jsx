import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { Layout } from "./components/Layout";
import { LogoMark } from "./components/Logo";
import { useAuth } from "./lib/auth";
import { useTheme } from "./lib/theme";
import Login from "./pages/Login";

const Home = lazy(() => import("./pages/Home"));
const TestChat = lazy(() => import("./pages/TestChat"));
const Conversations = lazy(() => import("./pages/Conversations"));
const Tickets = lazy(() => import("./pages/Tickets"));
const Orders = lazy(() => import("./pages/Orders"));
const HelpDocs = lazy(() => import("./pages/HelpDocs"));
const Settings = lazy(() => import("./pages/Settings"));
const Widget = lazy(() => import("./pages/Widget"));
const NotFound = lazy(() => import("./pages/NotFound"));

function Splash() {
  return (
    <div className="grid h-full place-items-center">
      <LogoMark className="size-10 animate-pulse" />
    </div>
  );
}

function RequireAuth({ children }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) return <Splash />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;

  return children;
}

function App() {
  const { resolved } = useTheme();

  return (
    <>
      <Suspense fallback={<Splash />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/widget" element={<Widget />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route index element={<Home />} />
            <Route path="chat" element={<TestChat />} />
            <Route path="conversations" element={<Conversations />} />
            <Route path="tickets/:ticketId?" element={<Tickets />} />
            <Route path="orders" element={<Orders />} />
            <Route path="docs" element={<HelpDocs />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
      <Toaster theme={resolved} position="bottom-right" richColors closeButton toastOptions={{ style: { fontFamily: "inherit" } }} />
    </>
  );
}

export default App;
