
export enum UserRole {
  ADMIN = 'MediSys Admin',
  STAFF = 'MediSys Staff',
  CLINIC = 'Clinic Staff',
}

export enum ReportStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  clinicId?: string; 
  clinicName?: string;
}

export interface Report {
  id: string;
  patientName: string;
  patientGender: 'Male' | 'Female' | 'Other';
  diagnosticType: string;
  submissionDate: string;
  status: ReportStatus;
  uploaderId: string;
  uploaderName: string;
  clinicName: string;
  fileUrl: string;
}

export interface DashboardStats {
  totalReports: number;
  approvedReports: number;
  pendingReports: number;
  rejectedReports: number;
  casesByDiagnostic: { name: string; value: number }[];
  genderDistribution: { name: string; value: number }[];
}
