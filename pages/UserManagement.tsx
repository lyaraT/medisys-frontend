import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { UserRole } from "../types";
import {
  getAllUsers,
  createUser as apiCreateUser,
  deleteUser as apiDeleteUser,
} from "../services/api";
import { PlusIcon, UserCircleIcon } from "@heroicons/react/24/solid";

type ApiRole = "ClinicStaff" | "MedisysStaff" | "MedisysAdmin";

/* ---------------- helpers ---------------- */

function toApiRole(role: UserRole): ApiRole {
  switch (role) {
    case UserRole.ADMIN:
      return "MedisysAdmin";
    case UserRole.STAFF:
      return "MedisysStaff";
    case UserRole.CLINIC:
    default:
      return "ClinicStaff";
  }
}

/** Normalize groups coming from the API (either `groups` or `Groups`) into a UI role */
function roleFromGroups(groups: string[] | undefined): "ADMIN" | "STAFF" | "CLINIC" {
  const g = groups ?? [];
  if (g.includes("MedisysAdmin") || g.includes("MedSysAdmin")) return "ADMIN";
  if (g.includes("MedisysStaff") || g.includes("MedSysStaff")) return "STAFF";
  if (g.includes("ClinicStaff")) return "CLINIC";
  return "CLINIC";
}

const roleBadge = (roleLike: ApiRole | "ADMIN" | "STAFF" | "CLINIC" | string) => {
  const norm =
    roleLike === "MedisysAdmin" || roleLike === "ADMIN"
      ? "ADMIN"
      : roleLike === "MedisysStaff" || roleLike === "STAFF"
      ? "STAFF"
      : "CLINIC";

  const colors: Record<string, string> = {
    ADMIN: "bg-red-200 text-red-800",
    STAFF: "bg-blue-200 text-blue-800",
    CLINIC: "bg-green-200 text-green-800",
  };

  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colors[norm]}`}>
      {norm}
    </span>
  );
};

function formatDate(d?: string | Date | null): string {
  if (!d) return "-";
  try {
    const dt = typeof d === "string" ? new Date(d) : d;
    return isNaN(dt.getTime()) ? "-" : dt.toLocaleString();
  } catch {
    return "-";
  }
}

/* ---------------- tiny flash/toast ---------------- */

type Flash = { type: "success" | "error"; text: string } | null;

const FlashToast: React.FC<{ flash: Flash; onClose: () => void }> = ({
  flash,
  onClose,
}) => {
  if (!flash) return null;
  const base =
    "fixed right-4 top-4 z-50 rounded-lg shadow-lg px-4 py-3 text-sm flex items-start gap-3";
  const styles =
    flash.type === "success"
      ? "bg-green-50 text-green-800 border border-green-200"
      : "bg-red-50 text-red-800 border border-red-200";

  return (
    <div className={`${base} ${styles}`}>
      <div className="font-semibold">
        {flash.type === "success" ? "Success" : "Error"}
      </div>
      <div className="opacity-90">{flash.text}</div>
      <button
        className="ml-2 text-xs underline opacity-70 hover:opacity-100"
        onClick={onClose}
        type="button"
      >
        Dismiss
      </button>
    </div>
  );
};

/* ---------------- component ---------------- */

const UserManagement: React.FC = () => {
  const { user } = useAuth();

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>(UserRole.CLINIC);
  const [clinicId, setClinicId] = useState("");
  const [creating, setCreating] = useState(false);

  const [flash, setFlash] = useState<Flash>(null);

  function notifySuccess(msg: string) {
    setFlash({ type: "success", text: msg });
  }
  function notifyError(msg: string) {
    setFlash({ type: "error", text: msg });
  }

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(t);
  }, [flash]);

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const data = await getAllUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const apiRole = toApiRole(role);
      const derivedName = email.includes("@") ? email.split("@")[0] : email;

      // Sanitize clinicId
      const finalClinicId = clinicId ? clinicId.trim().toUpperCase() : undefined;

      await apiCreateUser({
        email,
        role: apiRole,
        clinicId: role === UserRole.CLINIC ? finalClinicId : undefined,
        name: derivedName,
      });

      notifySuccess(`User ${email} created successfully.`);
      setEmail("");
      setClinicId("");
      setRole(UserRole.CLINIC);
      setShowCreateModal(false);
      await refresh();
    } catch (e: any) {
      notifyError(e?.message ?? "Failed to create user");
    } finally {
      setCreating(false);
    }
  }

  async function onDelete(u: any) {
    const identifier = u?.Email ?? u?.email ?? u?.Username ?? u?.username;
    if (!identifier) {
      notifyError("Unable to identify this user for deletion.");
      return;
    }
    if (!confirm(`Delete user ${identifier}?`)) return;

    try {
      await apiDeleteUser({ email: identifier });
      notifySuccess(`User ${identifier} deleted successfully.`);
      await refresh();
    } catch (e: any) {
      notifyError(e?.message ?? "Failed to delete user");
    }
  }

  if (user?.role !== UserRole.ADMIN) {
    return <div>Unauthorized</div>;
  }

  if (loading) {
    return <div className="text-center p-10">Loading users...</div>;
  }

  if (err) {
    return (
      <div className="text-center p-10 text-red-600">
        {err || "Failed to load users"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FlashToast flash={flash} onClose={() => setFlash(null)} />

      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">User Management</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center bg-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-primary-dark transition-transform transform hover:scale-105"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Create User
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((u, i) => {
          const emailVal = u.Email ?? u.email ?? "";
          const localPart = emailVal ? String(emailVal).split("@")[0] : "";
          const displayName =
            u.name ?? u.Name ?? (localPart || emailVal) ?? u.username ?? u.Username ?? "Unknown";

          const groups = (u.groups ?? u.Groups) as string[] | undefined;
          const uiRole = (u.role as string | undefined)?.toUpperCase?.() as
            | "ADMIN"
            | "STAFF"
            | "CLINIC"
            | undefined;
          const finalRole = uiRole ?? roleFromGroups(groups);

          const createdIso = u.createdAt ?? u.CreatedAt ?? u.UserCreateDate;
          const created = formatDate(createdIso);

          const clinicIdFromApi = u.clinicId ?? u.ClinicId ?? u["custom:clinicId"];

          return (
            <div
              key={i}
              className="bg-white rounded-xl shadow-md p-6 flex items-start space-x-4"
            >
              <div className="p-3 bg-secondary rounded-full">
                <UserCircleIcon className="h-8 w-8 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg text-gray-800">{displayName}</h3>
                <p className="text-sm text-gray-500">{emailVal}</p>

                <div className="mt-2">{roleBadge(finalRole)}</div>

                {finalRole === "CLINIC" && clinicIdFromApi && (
                  <p className="text-sm text-gray-600 mt-1">
                    Clinic ID: <span className="font-medium">{clinicIdFromApi}</span>
                  </p>
                )}

                <div className="mt-3 text-xs text-gray-500">Created: {created}</div>

                <div className="mt-4">
                  <button
                    onClick={() => onDelete(u)}
                    className="text-red-600 hover:text-red-700 text-sm font-semibold"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-8 max-w-lg w-full">
            <h2 className="text-2xl font-bold mb-6">Create New User</h2>
            <form onSubmit={onCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as unknown as UserRole)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary bg-white"
                >
                  <option value={UserRole.CLINIC}>Clinic Staff</option>
                  <option value={UserRole.STAFF}>MediSys Staff</option>
                  <option value={UserRole.ADMIN}>MediSys Admin</option>
                </select>
              </div>

              {role === UserRole.CLINIC && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Clinic ID <span className="text-gray-500 text-xs">(format: CLINIC_001)</span>
                  </label>
                  <input
                    type="text"
                    value={clinicId}
                    onChange={(e) => setClinicId(e.target.value.toUpperCase())}
                    required
                    pattern="^CLINIC_\\d+$"
                    title="Clinic ID must match CLINIC_number (e.g., CLINIC_001)"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                  />
                </div>
              )}

              <div className="flex justify-end space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="bg-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-primary-dark disabled:bg-gray-400"
                >
                  {creating ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
