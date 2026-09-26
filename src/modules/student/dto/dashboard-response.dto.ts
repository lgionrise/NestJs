export interface DashboardResponse {
  greeting: string;
  profile: {
    fullName: string | null;
    photoUrl: string | null;
    className: string | null;
    isOnboardingDone: boolean;
  };
  accountStatus: {
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
    twoFactorEnabled: boolean;
    memberSince: Date;
  };
  activeSessions: {
    count: number;
    devices: Array<{
      deviceId: string;
      userAgent: string | null;
      lastActiveAt: Date;
      ipAddress: string | null;
    }>;
  };
  enrolledBatches: {
    count: number;
    items: unknown[]; // populated once Batch-Enrollment module is built
  };
  upcomingLiveClasses: unknown[]; // populated once Live-Class module is built
  progressOverview: {
    watched: number;
    pending: number;
    completed: number;
  } | null; // populated once Recorded-Content module is built
  testPerformanceSummary: {
    testsAttempted: number;
    averageScore: number | null;
  } | null; // populated once Tests module is built
  notificationsWidget: {
    unreadCount: number;
  }; // fully populated once Notifications module is built
  quickLinks: Array<{ label: string; path: string }>;
}
