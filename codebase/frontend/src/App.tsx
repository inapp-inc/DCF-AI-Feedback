import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { RequireAdminAuth, RequireIFamilyNetAuth } from "./auth/RequireAuth";
import { LoginPage } from "./pages/LoginPage";
import { PlatformSelectPage } from "./pages/PlatformSelectPage";
import { IFamilyNetPage } from "./pages/IFamilyNetPage";
import { AdminPage } from "./pages/AdminPage";
import { PortalLandingPage } from "./pages/PortalLandingPage";
import { SurveyFillPage } from "./pages/SurveyFillPage";

const routerBasename = (import.meta.env.BASE_URL || "/").replace(/\/$/, "") || undefined;

export function App() {
  return (
    <BrowserRouter basename={routerBasename}>
      <Routes>
        <Route path="/" element={<PlatformSelectPage />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/login/:platform" element={<LoginPage />} />
        <Route path="/portal" element={<PortalLandingPage />} />
        <Route path="/survey/:token" element={<SurveyFillPage />} />
        <Route element={<RequireIFamilyNetAuth />}>
          <Route path="/ifamilynet" element={<IFamilyNetPage />} />
        </Route>
        <Route element={<RequireAdminAuth />}>
          <Route path="/admin" element={<AdminPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
