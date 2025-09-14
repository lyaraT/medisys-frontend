import React from "react";
import { useAuth } from "../context/AuthContext";
import { UserIcon, ArrowRightOnRectangleIcon } from "@heroicons/react/24/solid";

const Header: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white shadow-md p-4 flex justify-end items-center">
      <div className="flex items-center space-x-4">
        <div className="text-right">
          <p className="font-semibold text-gray-800">{user?.name}</p>
          <p className="text-sm text-gray-500">{user?.role}</p>
        </div>
        <div className="p-2 bg-primary text-white rounded-full">
          <UserIcon className="h-6 w-6" />
        </div>
        <button
          onClick={logout}
          className="flex items-center space-x-2 text-gray-600 hover:text-primary transition-colors"
          aria-label="Logout"
        >
          <ArrowRightOnRectangleIcon className="h-6 w-6" />
        </button>
      </div>
    </header>
  );
};

export default Header;
