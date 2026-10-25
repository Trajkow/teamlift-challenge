import {Module} from '@nestjs/common';
import {APP_FILTER, APP_GUARD} from '@nestjs/core';
import {ThrottlerModule} from '@nestjs/throttler';
import {DbExceptionFilter} from './common/errors/db-exception.filter.js';
import {HealthController} from './common/health/health.controller.js';
import {AppThrottlerGuard, throttlerOptions} from './common/rate-limit/rate-limit.js';
import {PrismaModule} from './prisma/prisma.module.js';

@Module({
  imports: [ThrottlerModule.forRoot(throttlerOptions), PrismaModule],
  controllers: [HealthController],
  providers: [
    {provide: APP_GUARD, useClass: AppThrottlerGuard},
    {provide: APP_FILTER, useClass: DbExceptionFilter},
  ],
})
export class AppModule {}
