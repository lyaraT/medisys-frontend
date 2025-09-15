import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import type { Report } from "../types";
import { ReportStatus, UserRole } from "../types";
import {
  getMyReports,
  getApprovedReports,
  getAllReports,
  reviewReport,
  deleteReport as apiDeleteReport,
  requestUploadUrl,
} from "../services/api";
import {
  PlusIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrashIcon,
  ClockIcon,
} from "@heroicons/react/24/solid";

/* SECTION: Role helpers — safe fallback if AuthContext isn't populated yet */
function getJwtGroups(): string[] {
  try {
    const token = localStorage.getItem("cognito_id_token");
    if (!token) return [];
    const base64Url = token.split(".")[1];
    if (!base64Url) return [];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return payload["cognito:groups"] || [];
  } catch {
    return [];
  }
}
function roleFromGroups(groups: string[]): UserRole {
  if (!groups || !groups.length) return UserRole.CLINIC;
  if (groups.includes("MedisysAdmin") || groups.includes("MedSysAdmin"))
    return UserRole.ADMIN;
  if (groups.includes("MedisysStaff") || groups.includes("MedSysStaff"))
    return UserRole.STAFF;
  return UserRole.CLINIC;
}

/* SECTION: UI helper — consistent status badge */
const getStatusBadge = (status: ReportStatus) => {
  switch (status) {
    case ReportStatus.APPROVED:
      return (
        <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-200 rounded-full">
          Approved
        </span>
      );
    case ReportStatus.PENDING:
      return (
        <span className="px-2 py-1 text-xs font-semibold text-yellow-800 bg-yellow-200 rounded-full">
          Pending
        </span>
      );
    case ReportStatus.REJECTED:
      return (
        <span className="px-2 py-1 text-xs font-semibold text-red-800 bg-red-200 rounded-full">
          Rejected
        </span>
      );
    default:
      return (
        <span className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-200 rounded-full">
          Unknown
        </span>
      );
  }
};

const Reports: React.FC = () => {
  const { user } = useAuth();

  /* SECTION: Role detection — prefer context, fall back to JWT groups */
  const safeRole: UserRole = useMemo(() => {
    if (user?.role) return user.role;
    return roleFromGroups(getJwtGroups());
  }, [user?.role]);

  /* SECTION: State — reports list, UX state, and toasts */
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const flash = (type: "success" | "error", text: string) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 5000);
  };

  const isClinic = safeRole === UserRole.CLINIC;
  const isAdmin = safeRole === UserRole.ADMIN;
  const isStaff = safeRole === UserRole.STAFF;

  /* SECTION: Data fetch — role-aware sources; tolerant to shapes */
  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isClinic) {
        const data = await getMyReports();
        setReports((data as unknown as any[]) ?? []);
      } else if (isStaff) {
        const data = await getApprovedReports();
        const arr = Array.isArray(data) ? data : [];
        arr
          .sort((a: any, b: any) =>
            String(a.UploadTime ?? "").localeCompare(String(b.UploadTime ?? "")
            )
          )
          .reverse();
        setReports(arr);
      } else {
        // Admin — may return normalized or raw; render tolerantly
        const raw = (await getAllReports()) as any[];
        setReports(Array.isArray(raw) ? raw : []);
      }
    } catch (err: any) {
      console.error("Failed to fetch reports:", err);
      setError(err?.message ?? "Failed to fetch reports");
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [isClinic, isStaff]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  /* SECTION: Actions — Admin approve/reject/delete with success/error flashes */
  const handleStatusChange = async (reportId: string, status: ReportStatus) => {
    try {
      await reviewReport(reportId, {
        status:
          status === ReportStatus.APPROVED
            ? "Approved"
            : status === ReportStatus.REJECTED
            ? "Rejected"
            : "Pending",
      });
      await fetchReports();
      if (status === ReportStatus.APPROVED) {
        flash("success", `Report ${reportId} approved successfully.`);
      } else if (status === ReportStatus.REJECTED) {
        flash("success", `Report ${reportId} rejected successfully.`);
      } else {
        flash("success", `Report ${reportId} status updated.`);
      }
    } catch (err: any) {
      console.error(`Failed to update report ${reportId} status:`, err);
      flash("error", err?.message || "Failed to update report status.");
    }
  };

  const handleDelete = async (reportId: string) => {
    if (window.confirm("Are you sure you want to delete this report?")) {
      try {
        await apiDeleteReport(reportId);
        await fetchReports();
        flash("success", `Report ${reportId} deleted successfully.`);
      } catch (error: any) {
        console.error(`Failed to delete report ${reportId}:`, error);
        flash("error", error?.message || "Failed to delete report.");
      }
    }
  };

  /* SECTION: Upload (Clinic) — presigned URL flow; no base64 anywhere */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.target as HTMLInputElement;
    if (!(inputEl.files && inputEl.files[0])) return;

    const file = inputEl.files[0];
    if (!/\.csv$/i.test(file.name)) {
      alert("Please upload a .csv file (Excel .xlsx won't be processed).");
      inputEl.value = "";
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const contentType = "text/csv";
      const presign: any = await requestUploadUrl(file.name, contentType);
      const uploadUrl: string = presign.uploadUrl;

      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });

      if (!put.ok) {
        const t = await put.text();
        throw new Error(`S3 upload failed: ${put.status} ${t || put.statusText}`);
      }

      flash(
        "success",
        `Report file "${file.name}" uploaded successfully. Processing has started.`
      );
      await fetchReports();
    } catch (err: any) {
      console.error("Upload failed", err);
      flash("error", err?.message || "Upload failed. See console for details.");
    } finally {
      setIsUploading(false);
      setShowUploadModal(false);
      if (inputEl) inputEl.value = "";
    }
  };

  if (loading) {
    return <div className="text-center p-10">Loading reports...</div>;
  }

  /* SECTION: Rendering helpers — normalize status across shapes */
  const asStatusEnum = (r: any): ReportStatus => {
    const s = String(r?.status ?? r?.Status ?? "PENDING").toUpperCase();
    return s === "APPROVED"
      ? ReportStatus.APPROVED
      : s === "REJECTED"
      ? ReportStatus.REJECTED
      : ReportStatus.PENDING;
  };

  const headerTitle = isClinic ? "My Reports" : isStaff ? "Approved Reports" : "All Reports";

  return (
    <div className="space-y-6">
      {/* SECTION: Header & upload CTA (Clinic only) */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">{headerTitle}</h1>
        {isClinic && (
          <button
            onClick={() => {
              setNotice(null);
              setShowUploadModal(true);
            }}
            className="flex items-center bg-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-primary-dark transition-transform transform hover:scale-105 disabled:opacity-60"
            disabled={isUploading}
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Upload Report
          </button>
        )}
      </div>

      {/* SECTION: Toasts & errors */}
      {notice && (
        <div
          className={`rounded-md px-4 py-3 ${
            notice.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {notice.text}
        </div>
      )}
      {error && <div className="text-center p-4 text-red-500">{error}</div>}

      {/* SECTION: Tables — admin/clinic detailed; staff read-only */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          {!isStaff ? (
            /* ---------- Admin & Clinic detailed table ---------- */
            <table className="min-w-full text-sm divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Report ID</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Patient ID</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Patient Name</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Diagnostic Type</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Diagnosis Result</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Blood Type</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Patient Gender</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Date of Birth</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Last Checked</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Submitted</th>
                  {!isClinic && (
                    <th className="px-6 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Clinic</th>
                  )}
                  {!isClinic && (
                    <th className="px-6 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  )}
                  {!isClinic && (
                    <th className="px-6 py-3 text-center font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reports.map((r: any, idx: number) => {
                  const reportId = r?.ReportId ?? r?.REPORT_ID ?? r?.id ?? r?.reportId ?? idx;
                  const patientId = r?.PATIENT_ID ?? r?.patientId ?? "";
                  const fullName =
                    [r?.PATIENTFIRSTNAME, r?.PATIENTLASTNAME].filter(Boolean).join(" ") ||
                    r?.patientName ||
                    patientId ||
                    "—";
                  const diagType = r?.DIAGNOSTICTYPE ?? r?.diagnosticType ?? "—";
                  const diagResult = r?.DIAGNOSISRESULT ?? "—";
                  const bloodType = r?.BLOODTYPE ?? "—";
                  const gender = r?.PATIENTGENDER ?? "—";
                  const dob = r?.DATEOFBIRTH ?? "—";
                  const lastChecked = r?.LASTCHECKED ?? r?.lastChecked ?? "—";
                  const submitted = r?.UploadTime ?? r?.submissionDate ?? "—";
                  const clinic = r?.CLINIC_ID ?? r?.clinicName ?? "—";
                  const statusEnum = asStatusEnum(r);

                  return (
                    <tr key={String(reportId)} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-medium">{String(reportId)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{patientId || "—"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-medium">{fullName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{diagType}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{diagResult}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{bloodType}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{gender}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{dob}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{lastChecked}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{submitted}</td>
                      {!isClinic && (
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{clinic}</td>
                      )}
                      {!isClinic && (
                        <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(statusEnum)}</td>
                      )}
                      {!isClinic && (
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {statusEnum === ReportStatus.PENDING ? (
                            <div className="flex items-center justify-center space-x-2">
                              <button
                                onClick={() =>
                                  handleStatusChange(String(reportId), ReportStatus.APPROVED)
                                }
                                className="text-green-500 hover:text-green-700"
                                title="Approve"
                              >
                                <CheckCircleIcon className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() =>
                                  handleStatusChange(String(reportId), ReportStatus.REJECTED)
                                }
                                className="text-red-500 hover:text-red-700"
                                title="Reject"
                              >
                                <XCircleIcon className="h-5 w-5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center space-x-2">
                              <button
                                onClick={() => handleDelete(String(reportId))}
                                className="text-gray-500 hover:text-red-700"
                                title="Delete"
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}

                {reports.length === 0 && (
                  <tr>
                    <td
                      colSpan={isClinic ? 10 : 13}
                      className="px-6 py-8 text-center text-gray-500"
                    >
                      No reports to display.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            /* ---------- MediSys Staff read-only table (approved only) ---------- */
            <table className="min-w-full text-sm divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
                    Report ID
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
                    Patient ID
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
                    Patient Name
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
                    Diagnostic Type
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
                    Diagnosis Result
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
                    Blood Type
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
                    Patient Gender
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
                    Date of Birth
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
                    Last Checked
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reports.map((r: any, idx: number) => {
                  const reportId = r?.ReportId ?? r?.REPORT_ID ?? idx;
                  const fullName = [r?.PATIENTFIRSTNAME, r?.PATIENTLASTNAME]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <tr key={reportId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-medium">
                        {String(reportId)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {r?.PATIENT_ID || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-medium">
                        {fullName || r?.PATIENT_ID || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {r?.DIAGNOSTICTYPE || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {r?.DIAGNOSISRESULT || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {r?.BLOODTYPE || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {r?.PATIENTGENDER || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {r?.DATEOFBIRTH || "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {r?.LASTCHECKED || "—"}
                      </td>
                    </tr>
                  );
                })}

                {reports.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                      No approved reports to display.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* SECTION: Upload modal (Clinic) */}
      {showUploadModal && isClinic && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Upload New Report</h2>
            <p className="mb-6 text-gray-600">Please select a CSV file to upload.</p>
            {isUploading ? (
              <div className="flex flex-col items-center justify-center">
                <ClockIcon className="h-12 w-12 text-primary animate-spin" />
                <p className="mt-4 text-gray-700">Uploading and processing...</p>
              </div>
            ) : (
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-dark file:text-white hover:file:bg-primary"
              />
            )}
            <button
              onClick={() => setShowUploadModal(false)}
              className="mt-6 w-full bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
