import { Navigate, Outlet } from "react-router-dom";
import { SESSION_KEYS, getLoggedInPlatform, isStaffPlatform, loginPath, type StaffPlatform } from "./platform";

type RequireAuthProps = {
  platform: StaffPlatform;
};

export function RequireAuth({ platform }: RequireAuthProps) {
  const username = sessionStorage.getItem(SESSION_KEYS.username);
  const loggedPlatform = getLoggedInPlatform();

  if (!username) {
    return <Navigate to={loginPath(platform)} replace />;
  }

  if (loggedPlatform !== platform) {
    return <Navigate to={loginPath(platform)} replace />;
  }

  return <Outlet />;
}

export function RequireWorkflowAuth() {
  return <RequireAuth platform="workflow" />;
}

export function RequireAdminAuth() {
  return <RequireAuth platform="admin" />;
}
