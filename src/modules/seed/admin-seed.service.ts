import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AdminSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    const username = this.configService.get<string>('BOOTSTRAP_ADMIN_USERNAME', 'ZEAIPC');
    const password = this.configService.get<string>('BOOTSTRAP_ADMIN_PASSWORD', 'arman');
    const saltRounds = this.configService.get<number>('BCRYPT_SALT_ROUNDS', 12);

    try {
      const existing = await this.prisma.user.findUnique({ where: { username } });

      if (existing) {
        this.logger.log(`Bootstrap admin '${username}' already exists. Skipping seed.`);
        return;
      }

      const passwordHash = await bcrypt.hash(password, saltRounds);

      await this.prisma.user.create({
        data: {
          username,
          passwordHash,
          role: Role.SUPER_ADMIN,
          isActive: true,
          isEmailVerified: true,
        },
      });

      this.logger.log(`Bootstrap admin '${username}' created successfully.`);
    } catch (error) {
      this.logger.error(
        `Failed to seed bootstrap admin: ${(error as Error).message}`,
      );
    }
  }
}
