
import { User, Report, UserRole, ReportStatus, DashboardStats } from '../types';

export const MOCK_USERS: User[] = [
  { id: 'user-1', name: 'Dr. Alice Admin', email: 'admin@medisys.com', role: UserRole.ADMIN },
  { id: 'user-2', name: 'Bob Staff', email: 'staff@medisys.com', role: UserRole.STAFF },
  { id: 'user-3', name: 'Charlie Clinic', email: 'charlie@clinic.com', role: UserRole.CLINIC, clinicId: 'clinic-a', clinicName: 'Sunshine Clinic' },
  { id: 'user-4', name: 'Diana Clinic', email: 'diana@clinic.com', role: UserRole.CLINIC, clinicId: 'clinic-b', clinicName: 'Wellspring Health' },
];

let MOCK_REPORTS: Report[] = [
  { id: 'report-1', patientName: 'John Doe', patientGender: 'Male', diagnosticType: 'Blood Test', submissionDate: '2024-07-28', status: ReportStatus.APPROVED, uploaderId: 'user-3', uploaderName: 'Charlie Clinic', clinicName: 'Sunshine Clinic', fileUrl: '#' },
  { id: 'report-2', patientName: 'Jane Smith', patientGender: 'Female', diagnosticType: 'X-Ray', submissionDate: '2024-07-27', status: ReportStatus.PENDING, uploaderId: 'user-3', uploaderName: 'Charlie Clinic', clinicName: 'Sunshine Clinic', fileUrl: '#' },
  { id: 'report-3', patientName: 'Peter Jones', patientGender: 'Male', diagnosticType: 'MRI', submissionDate: '2024-07-26', status: ReportStatus.REJECTED, uploaderId: 'user-4', uploaderName: 'Diana Clinic', clinicName: 'Wellspring Health', fileUrl: '#' },
  { id: 'report-4', patientName: 'Mary Williams', patientGender: 'Female', diagnosticType: 'Blood Test', submissionDate: '2024-07-25', status: ReportStatus.APPROVED, uploaderId: 'user-4', uploaderName: 'Diana Clinic', clinicName: 'Wellspring Health', fileUrl: '#' },
  { id: 'report-5', patientName: 'David Brown', patientGender: 'Male', diagnosticType: 'Ultrasound', submissionDate: '2024-07-29', status: ReportStatus.PENDING, uploaderId: 'user-4', uploaderName: 'Diana Clinic', clinicName: 'Wellspring Health', fileUrl: '#' },
];

const api = {
  getReports: async (user: User): Promise<Report[]> => {
    await new Promise(res => setTimeout(res, 500)); // Simulate network delay
    switch (user.role) {
      case UserRole.ADMIN:
        return MOCK_REPORTS.sort((a, b) => new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime());
      case UserRole.STAFF:
        return MOCK_REPORTS.filter(r => r.status === ReportStatus.APPROVED).sort((a, b) => new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime());
      case UserRole.CLINIC:
        return MOCK_REPORTS.filter(r => r.uploaderId === user.id).sort((a, b) => new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime());
      default:
        return [];
    }
  },

  updateReportStatus: async (reportId: string, status: ReportStatus): Promise<Report> => {
    await new Promise(res => setTimeout(res, 300));
    const reportIndex = MOCK_REPORTS.findIndex(r => r.id === reportId);
    if (reportIndex > -1) {
      MOCK_REPORTS[reportIndex].status = status;
      if(status === ReportStatus.APPROVED) {
        // Here you would trigger an SNS/SES notification to MediSys staff
        console.log(`Notification: Report ${reportId} approved. Notifying MediSys staff.`);
      }
      return MOCK_REPORTS[reportIndex];
    }
    throw new Error('Report not found');
  },

  deleteReport: async (reportId: string): Promise<void> => {
     await new Promise(res => setTimeout(res, 300));
     MOCK_REPORTS = MOCK_REPORTS.filter(r => r.id !== reportId);
  },

  uploadReport: async (file: File, uploader: User): Promise<Report> => {
    await new Promise(res => setTimeout(res, 1000));
     // Here you would upload to S3, then trigger a Lambda
    const newReport: Report = {
      id: `report-${Date.now()}`,
      patientName: 'New Patient', // Lambda would parse this from the file
      patientGender: Math.random() > 0.5 ? 'Male' : 'Female',
      diagnosticType: ['Blood Test', 'X-Ray', 'MRI'][Math.floor(Math.random() * 3)],
      submissionDate: new Date().toISOString().split('T')[0],
      status: ReportStatus.PENDING,
      uploaderId: uploader.id,
      uploaderName: uploader.name,
      clinicName: uploader.clinicName || 'N/A',
      fileUrl: '#',
    };
    MOCK_REPORTS.unshift(newReport);
     // Here an SNS/SES notification would be sent to Admins
    console.log(`Notification: New report ${newReport.id} submitted. Notifying Admins.`);
    return newReport;
  },
  
  getUsers: async (): Promise<User[]> => {
    await new Promise(res => setTimeout(res, 500));
    return MOCK_USERS;
  },

  createUser: async (name: string, email: string, role: UserRole, clinicName: string): Promise<User> => {
    await new Promise(res => setTimeout(res, 500));
    const newUser: User = {
      id: `user-${Date.now()}`,
      name,
      email,
      role,
      clinicId: role === UserRole.CLINIC ? `clinic-${Date.now()}` : undefined,
      clinicName: role === UserRole.CLINIC ? clinicName : undefined,
    };
    MOCK_USERS.push(newUser);
    return newUser;
  },
  
  getDashboardStats: async (): Promise<DashboardStats> => {
    await new Promise(res => setTimeout(res, 700));
    
    const stats: DashboardStats = {
      totalReports: MOCK_REPORTS.length,
      approvedReports: MOCK_REPORTS.filter(r => r.status === ReportStatus.APPROVED).length,
      pendingReports: MOCK_REPORTS.filter(r => r.status === ReportStatus.PENDING).length,
      rejectedReports: MOCK_REPORTS.filter(r => r.status === ReportStatus.REJECTED).length,
      casesByDiagnostic: MOCK_REPORTS.reduce((acc, report) => {
        const existing = acc.find(item => item.name === report.diagnosticType);
        if (existing) {
          existing.value++;
        } else {
          acc.push({ name: report.diagnosticType, value: 1 });
        }
        return acc;
      }, [] as { name: string; value: number }[]),
      genderDistribution: MOCK_REPORTS.reduce((acc, report) => {
        const existing = acc.find(item => item.name === report.patientGender);
        if (existing) {
          existing.value++;
        } else {
          acc.push({ name: report.patientGender, value: 1 });
        }
        return acc;
      }, [] as { name: string; value: number }[]),
    };
    return stats;
  }
};

export default api;
