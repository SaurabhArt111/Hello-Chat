import React, { useEffect, useState } from "react";
import {
  getAdminDashboard,
  getAdminDashboardCharts,
  getAdminActivityFeed,
  getAdminTopActiveUsers,
  getAdminSystemHealth,
  getAdminReportStats,
} from "../../api/admin";
import {
  KPICard,
  UserGrowthChart,
  MessagesPerDayChart,
  ActivityFeed,
  ReportsSummaryWidget,
  SystemHealthWidget,
  TopActiveUsersTable,
} from "../../components/admin/dashboard";
import {
  Users,
  Activity,
  MessageSquare,
  Ban,
  Flag,
  LayoutDashboard,
} from "lucide-react";

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);
  const [activities, setActivities] = useState([]);
  const [topUsers, setTopUsers] = useState([]);
  const [health, setHealth] = useState(null);
  const [reportStats, setReportStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [statsRes, chartsRes, activityRes, topRes, healthRes, reportRes] =
          await Promise.all([
            getAdminDashboard(),
            getAdminDashboardCharts(),
            getAdminActivityFeed(15),
            getAdminTopActiveUsers(8),
            getAdminSystemHealth(),
            getAdminReportStats(),
          ]);
        setStats(statsRes.data);
        setCharts(chartsRes.data);
        setActivities(activityRes.data?.activities || []);
        setTopUsers(topRes.data?.users || []);
        setHealth(healthRes.data);
        setReportStats(reportRes.data);
      } catch (err) {
        console.error(err);
        setError("Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-6 text-red-600 dark:text-red-400">
          {error}
        </div>
      </div>
    );
  }

  const kpiConfig = [
    {
      key: "totalUsers",
      label: "Total Users",
      value: stats?.totalUsers,
      change: stats?.changes?.totalUsers,
      description: "Registered accounts",
      icon: Users,
    },
    {
      key: "activeUsers24h",
      label: "Active (24h)",
      value: stats?.activeUsers24h,
      change: stats?.changes?.activeUsers24h,
      description: "Users active in last 24 hours",
      icon: Activity,
    },
    {
      key: "totalMessages",
      label: "Total Messages",
      value: stats?.totalMessages,
      change: stats?.changes?.totalMessages,
      description: "All-time message count",
      icon: MessageSquare,
    },
    {
      key: "bannedUsers",
      label: "Banned Users",
      value: stats?.bannedUsers,
      change: stats?.changes?.bannedUsers,
      description: "Accounts currently banned",
      icon: Ban,
    },
    {
      key: "openReports",
      label: "Open Reports",
      value: stats?.openReports,
      change: stats?.changes?.openReports,
      description: "Reports awaiting review",
      icon: Flag,
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-neutral-100 flex items-center gap-2">
            <LayoutDashboard className="h-8 w-8 text-emerald-500" />
            Admin Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-neutral-400">
            Overview of your platform metrics and activity
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <section>
        <h2 className="sr-only">Key metrics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {kpiConfig.map((k) => (
            <KPICard
              key={k.key}
              label={k.label}
              value={k.value}
              description={k.description}
              change={k.change}
              icon={k.icon}
              loading={loading}
            />
          ))}
        </div>
      </section>

      {/* Charts row */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UserGrowthChart
          data={charts?.userGrowth}
          loading={loading}
        />
        <MessagesPerDayChart
          data={charts?.messagesPerDay}
          loading={loading}
        />
      </section>

      {/* Middle row: Activity + Reports + Health */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ActivityFeed activities={activities} loading={loading} />
        </div>
        <div className="space-y-6">
          <ReportsSummaryWidget
            pending={reportStats?.open || 0}
            resolved={reportStats?.actionTaken || 0}
            highSeverity={reportStats?.highSeverity || 0}
            loading={loading}
          />
          <SystemHealthWidget
            api={health?.api}
            database={health?.database}
            uptimeSeconds={health?.uptimeSeconds}
            activeSessions={health?.activeSessions}
            databaseLatencyMs={health?.databaseLatencyMs}
            loading={loading}
          />
        </div>
      </section>

      {/* Top Active Users */}
      <section>
        <TopActiveUsersTable users={topUsers} loading={loading} />
      </section>
    </div>
  );
};

export default AdminDashboard;
