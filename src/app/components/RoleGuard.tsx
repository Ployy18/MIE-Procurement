import React from "react";
import { Navigate } from "react-router-dom";
import authService from "../../services/authService";

interface RoleGuardProps {
  children: React.ReactNode;
  roles?: string[];
}

const RoleGuard: React.FC<RoleGuardProps> = ({ children, roles }) => {
  const user = authService.getCurrentUser();
  const isAuthenticated = authService.isAuthenticated();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && (!user?.role || !roles.includes(user.role))) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

export default RoleGuard;
