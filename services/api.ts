// src/services/api.ts
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

const API_BASE_URL = "https://vxty9ac0h2.execute-api.us-east-1.amazonaws.com";

// --- Auth token helper ---
function getIdToken(): string | null {
  return localStorage.getItem("cognito_id_token");
}

// --- Core fetch wrapper ---
async function apiFetch<T>(
  path: string,
  method: HttpMethod,
  body?: BodyInit | Record<string, any> | null,
  options?: { signal?: AbortSignal; headers?: Record<string, string> }
): Promise<T> {
  const token = getIdToken();
  if (!token) throw new Error("Not authenticated: missing ID token");

  const headers = new Headers(options?.headers);
  headers.set("Authorization", `Bearer ${token}`);

  let finalBody: BodyInit | undefined;

  if (body instanceof FormData) {
    finalBody = body;
  } else if (body && method !== "GET") {
    headers.set("Content-Type", "application/json");
    finalBody = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: finalBody,
    signal: options?.signal,
    mode: "cors",
    cache: "no-store",
  });

  const text = await res.text();
  let data: any = undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    // keep raw text if backend returns non-JSON
  }

  if (!res.ok) {
    const msg =
      (data && (data.message || data.error || data.detail)) ||
      text ||
      res.statusText ||
      "Request failed";
    throw new Error(`${res.status} ${msg}`);
  }

  return (data as T) ?? (undefined as unknown as T);
}

/* =======================
   Presigned URL Flow
   ======================= */

// 1) Ask backend for a presigned PUT URL and S3 key
export async function requestUploadUrl(filename: string, contentType: string) {
  // Backend may return extra fields (objectKey, clinicId, etc.); we only need URL + key
  return apiFetch<{ uploadUrl: string; key: string }>(
    "/upload-reports",
    "POST",
    { filename, contentType }
  );
}

/* =======================
   Reports
   ======================= */

export async function getMyReports() {
  return apiFetch<any[]>("/my-reports", "GET");
}

export async function getApprovedReports() {
  return apiFetch<any[]>("/approved-reports", "GET");
}

export async function getAllReports() {
  return apiFetch<any[]>("/all-reports", "GET");
}

export async function reviewReport(
  reportId: string,
  payload: { status: string; note?: string }
) {
  return apiFetch<{ message: string }>(
    `/review-report/${reportId}`,
    "PUT",
    payload
  );
}

export async function deleteReport(reportId: string) {
  return apiFetch<{ message: string }>(`/review-report/${reportId}`, "DELETE");
}

/* =======================
   Dashboard
   ======================= */

export async function getDashboardStats() {
  return apiFetch<any>("/dashboard-stats", "GET");
}

/* =======================
   Users (Admin only)
   ======================= */

export async function getAllUsers() {
  return apiFetch<any[]>("/all-users", "GET");
}

export async function createUser(payload: {
  email: string;
  role: "ClinicStaff" | "MedisysStaff" | "MedisysAdmin";
  clinicId?: string; // <-- added
  name?: string;
}) {
  const localPart = (payload.email && payload.email.split("@")[0]) || "user";
  const body = {
    email: payload.email,
    username: payload.email,
    name: payload.name || localPart,
    role: payload.role,
    group: payload.role,
    userRole: payload.role,
    ...(payload.clinicId ? { clinicId: payload.clinicId } : {}), // <-- forward to backend
  };
  return apiFetch<{ message: string; clinicId?: string }>("/user", "POST", body);
}

export async function deleteUser(payload: { email?: string; username?: string }) {
  const body = {
    ...(payload.email ? { email: payload.email, username: payload.email } : {}),
    ...(payload.username ? { username: payload.username } : {}),
  };
  return apiFetch<{ message: string }>("/user", "DELETE", body);
}
