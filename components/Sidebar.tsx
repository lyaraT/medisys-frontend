import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { UserRole } from "../types";
import {
  ChartBarIcon,
  DocumentTextIcon,
  UsersIcon,
  BeakerIcon,
  ArrowRightOnRectangleIcon,
  ArrowUpOnSquareIcon,
} from "@heroicons/react/24/solid";

const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();

  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `flex items-center px-4 py-3 text-lg font-medium transition-colors duration-200 transform rounded-lg ${
      isActive
        ? "bg-primary-dark text-white"
        : "text-gray-200 hover:bg-primary-dark hover:text-white"
    }`;

  return (
    <aside className="hidden md:flex flex-col w-64 bg-primary text-white">
      <div className="flex items-center justify-center h-20 border-b border-primary-dark">
        <BeakerIcon className="h-8 w-8 mr-2" />
        <span className="text-2xl font-bold">MediSys</span>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-2">
        <NavLink to="/dashboard" end className={navLinkClasses}>
          <ChartBarIcon className="h-6 w-6 mr-3" />
          Dashboard
        </NavLink>

        {user?.role === UserRole.CLINIC ? (
          <>
            <NavLink to="/upload" className={navLinkClasses}>
              <ArrowUpOnSquareIcon className="h-6 w-6 mr-3" />
              Upload Report
            </NavLink>
            <NavLink to="/reports" className={navLinkClasses}>
              <DocumentTextIcon className="h-6 w-6 mr-3" />
              My Report History
            </NavLink>
          </>
        ) : (
          <NavLink to="/reports" className={navLinkClasses}>
            <DocumentTextIcon className="h-6 w-6 mr-3" />
            Reports
          </NavLink>
        )}

        {user?.role === UserRole.ADMIN && (
          <NavLink to="/users" className={navLinkClasses}>
            <UsersIcon className="h-6 w-6 mr-3" />
            User Management
          </NavLink>
        )}
      </nav>

      <div className="px-2 py-4 border-t border-primary-dark">
        <button
          onClick={logout}
          className="w-full flex items-center px-4 py-3 text-lg font-medium rounded-lg text-gray-200 hover:bg-primary-dark hover:text-white"
        >
          <ArrowRightOnRectangleIcon className="h-6 w-6 mr-3" />
          Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
