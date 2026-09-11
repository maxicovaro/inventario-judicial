import AppRouter from "./router/AppRouter";
import { ToastContainer } from "react-toastify";
import { AuthProvider } from "./auth/AuthProvider";
import "react-toastify/dist/ReactToastify.css";
import "@fontsource/inter";
import "./styles/design-system.css";
import "./styles/ui-kit.css";
import "./styles/auth-security.css";

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />

      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnHover
        theme="light"
      />
    </AuthProvider>
  );
}
