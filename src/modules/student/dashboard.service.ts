import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DashboardResponse } from './dto/dashboard-response.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(userId: string): Promise<DashboardResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        studentProfile: true,
        sessions: {
          where: { isActive: true },
          orderBy: { lastActiveAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const profile = user.studentProfile;
    const firstName = profile?.fullName?.split(' ')[0] ?? 'Student';
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    return {
      greeting: `${timeGreeting}, ${firstName}!`,
      profile: {
        fullName: profile?.fullName ?? null,
        photoUrl: profile?.photoUrl ?? null,
        className: profile?.className ?? null,
        isOnboardingDone: profile?.isOnboardingDone ?? false,
      },
      accountStatus: {
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        memberSince: user.createdAt,
      },
      activeSessions: {
        count: user.sessions.length,
        devices: user.sessions.map((s) => ({
          deviceId: s.deviceId,
          userAgent: s.userAgent,
          lastActiveAt: s.lastActiveAt,
          ipAddress: s.ipAddress,
        })),
      },
      enrolledBatches: {
        count: 0,
        items: [],
      },
      upcomingLiveClasses: [],
      progressOverview: null,
      testPerformanceSummary: null,
      notificationsWidget: {
        unreadCount: 0,
      },
      quickLinks: [
        { label: 'Complete Profile', path: '/student/profile' },
        { label: 'Browse Batches', path: '/batches' },
        { label: 'My Doubts', path: '/doubts' },
        { label: 'Security Settings', path: '/student/profile/security' },
      ],
    };
  }
}
