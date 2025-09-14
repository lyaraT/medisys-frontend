import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Sector,
} from "recharts";
import { getDashboardStats } from "../services/api";
import type { DashboardStats } from "../types";
import {
  DocumentCheckIcon,
  DocumentMinusIcon,
  DocumentMagnifyingGlassIcon,
  DocumentDuplicateIcon,
} from "@heroicons/react/24/outline";

/* ----------------------------- Stat Card ----------------------------- */
const StatCard: React.FC<{
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}> = ({ title, value, icon, color }) => (
  <div className="bg-white p-6 rounded-xl shadow-md flex items-center space-x-4">
    <div className={`rounded-full p-3 ${color}`}>{icon}</div>
    <div>
      <p className="text-sm text-gray-500 font-medium">{title}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  </div>
);

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

/* ---------------------- Pie active-slice renderer -------------------- */
const renderActiveShape = (props: any) => {
  const RADIAN = Math.PI / 180;
  const {
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
    payload,
    percent,
    value,
  } = props;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const sx = cx + (outerRadius + 10) * cos;
  const sy = cy + (outerRadius + 10) * sin;
  const mx = cx + (outerRadius + 30) * cos;
  const my = cy + (outerRadius + 30) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 22;
  const ey = my;
  const textAnchor = cos >= 0 ? "start" : "end";

  return (
    <g>
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill}>
        {payload.name}
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 6}
        outerRadius={outerRadius + 10}
        fill={fill}
      />
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 12}
        y={ey}
        textAnchor={textAnchor}
        fill="#333"
      >{`Cases ${value}`}</text>
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 12}
        y={ey}
        dy={18}
        textAnchor={textAnchor}
        fill="#999"
      >
        {`(Rate ${(percent * 100).toFixed(2)}%)`}
      </text>
    </g>
  );
};

/* --------------------------- Data helpers ---------------------------- */
type KV = { name: string; value: number };

function ensureArray(input: unknown): KV[] {
  if (Array.isArray(input)) {
    return input
      .map((x: any) => ({
        name: String(x?.name ?? x?.label ?? x?.type ?? "Unknown"),
        value: Number(x?.value ?? x?.count ?? 0) || 0,
      }))
      .filter((x) => !!x.name);
  }
  if (input && typeof input === "object") {
    return Object.entries(input as Record<string, any>).map(([k, v]) => ({
      name: String(k),
      value: Number((v as any)?.value ?? v ?? 0) || 0,
    }));
  }
  return [];
}

/** Normalize whatever the API returns into shapes the UI expects. */
function normalizeStats(raw: any): DashboardStats & {
  diagTypeApproved: KV[];
  diagnosisResultApproved: KV[];
  bloodTypeApproved: KV[];
  genderApproved: KV[];
} {
  return {
    // Top cards (keep existing behavior/keys)
    totalReports: Number(raw?.totalReports ?? raw?.total ?? 0),
    approvedReports: Number(raw?.approvedReports ?? raw?.approved ?? 0),
    pendingReports: Number(raw?.pendingReports ?? raw?.pending ?? 0),
    rejectedReports: Number(raw?.rejectedReports ?? raw?.rejected ?? 0),

    // (Legacy keys — kept for compatibility, not used by charts anymore)
    casesByDiagnostic: ensureArray(
      raw?.casesByDiagnostic ?? raw?.diagnostics ?? raw?.byTestType
    ),
    genderDistribution: ensureArray(
      raw?.genderDistribution ?? raw?.gender ?? raw?.genders ?? raw?.byGender
    ),

    // Approved-only breakouts
    diagTypeApproved: ensureArray(
      raw?.byDiagnosticTypeApproved ?? raw?.diagnosticsApproved
    ),
    diagnosisResultApproved: ensureArray(
      raw?.byDiagnosisResultApproved ?? raw?.diagnosisResultApproved
    ),
    bloodTypeApproved: ensureArray(
      raw?.byBloodTypeApproved ?? raw?.bloodTypeApproved
    ),
    genderApproved: ensureArray(raw?.byGenderApproved ?? raw?.genderApproved),
  } as any;
}

/* ----------------------------- Component ---------------------------- */
const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<
    (DashboardStats & {
      diagTypeApproved: KV[];
      diagnosisResultApproved: KV[];
      bloodTypeApproved: KV[];
      genderApproved: KV[];
    }) | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [activeGenderIdx, setActiveGenderIdx] = useState(0);
  const [activeBloodIdx, setActiveBloodIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getDashboardStats();
        setStats(normalizeStats(data));
      } catch (e: any) {
        console.error("Failed to fetch dashboard stats:", e);
        setError(e?.message ?? "Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="text-center p-10">Loading dashboard...</div>;
  }

  if (error || !stats) {
    return (
      <div className="text-center p-10 text-red-500">
        {error ?? "Failed to load dashboard data."}
      </div>
    );
  }

  // Approved-only datasets (NO fallbacks to all-status data)
  const diagTypeData = stats.diagTypeApproved ?? [];
  const diagnosisResultData = stats.diagnosisResultApproved ?? [];
  const bloodTypeData = (stats.bloodTypeApproved ?? []).map((d, i) => ({
    ...d,
    fill: COLORS[i % COLORS.length],
  }));
  const genderData = (stats.genderApproved ?? []).map((d, i) => ({
    ...d,
    fill: COLORS[i % COLORS.length],
  }));

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Reports"
          value={stats.totalReports ?? 0}
          icon={<DocumentDuplicateIcon className="h-6 w-6 text-white" />}
          color="bg-blue-500"
        />
        <StatCard
          title="Approved"
          value={stats.approvedReports ?? 0}
          icon={<DocumentCheckIcon className="h-6 w-6 text-white" />}
          color="bg-green-500"
        />
        <StatCard
          title="Pending Review"
          value={stats.pendingReports ?? 0}
          icon={<DocumentMagnifyingGlassIcon className="h-6 w-6 text-white" />}
          color="bg-yellow-500"
        />
        <StatCard
          title="Rejected"
          value={stats.rejectedReports ?? 0}
          icon={<DocumentMinusIcon className="h-6 w-6 text-white" />}
          color="bg-red-500"
        />
      </div>

      {/* Analytics: Approved-only */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Diagnostic Type (Bar) */}
        <div className="bg-white p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            Diagnostic Type (Approved)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={diagTypeData}
              margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip wrapperClassName="rounded-md shadow-lg" />
              <Legend />
              <Bar dataKey="value" fill="#005A9C" name="Cases" />
            </BarChart>
          </ResponsiveContainer>
          {diagTypeData.length === 0 && (
            <p className="text-sm text-gray-500 mt-3">
              No diagnostic data available.
            </p>
          )}
        </div>

        {/* Diagnosis Result (Bar) */}
        <div className="bg-white p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            Diagnosis Result (Approved)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={diagnosisResultData}
              margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip wrapperClassName="rounded-md shadow-lg" />
              <Legend />
              <Bar dataKey="value" fill="#2F855A" name="Cases" />
            </BarChart>
          </ResponsiveContainer>
          {diagnosisResultData.length === 0 && (
            <p className="text-sm text-gray-500 mt-3">
              No diagnosis result data available.
            </p>
          )}
        </div>

        {/* Blood Type (Pie) */}
        <div className="bg-white p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            Blood Type (Approved)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                activeIndex={bloodTypeData.length ? activeBloodIdx : -1}
                activeShape={renderActiveShape}
                data={bloodTypeData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                onMouseEnter={(_, i) => setActiveBloodIdx(i)}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
          {bloodTypeData.length === 0 && (
            <p className="text-sm text-gray-500 mt-3">
              No blood type data available.
            </p>
          )}
        </div>

        {/* Patient Gender (Pie) */}
        <div className="bg-white p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            Patient Gender (Approved)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                activeIndex={genderData.length ? activeGenderIdx : -1}
                activeShape={renderActiveShape}
                data={genderData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                onMouseEnter={(_, i) => setActiveGenderIdx(i)}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
          {genderData.length === 0 && (
            <p className="text-sm text-gray-500 mt-3">
              No gender distribution data available.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
