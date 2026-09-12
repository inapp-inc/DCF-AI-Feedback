import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { RequireAdminAuth, RequireWorkflowAuth } from "./auth/RequireAuth";
import { LoginPage } from "./pages/LoginPage";
import { PlatformSelectPage } from "./pages/PlatformSelectPage";
import { WorkflowPage } from "./pages/IFamilyNetPage";
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
        <Route path="/login/ifamilynet" element={<Navigate to="/login/workflow" replace />} />
        <Route path="/login/:platform" element={<LoginPage />} />
        <Route path="/portal" element={<PortalLandingPage />} />
        <Route path="/survey/:token" element={<SurveyFillPage />} />
        <Route path="/ifamilynet" element={<Navigate to="/workflow" replace />} />
        <Route element={<RequireWorkflowAuth />}>
          <Route path="/workflow" element={<WorkflowPage />} />
        </Route>
        <Route element={<RequireAdminAuth />}>
          <Route path="/admin" element={<AdminPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
