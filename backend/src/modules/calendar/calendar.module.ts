import {Logger, Module} from '@nestjs/common';
import {CalendarBusyService} from './calendar-busy.service.js';
import {CalendarClientResolver} from './calendar-client.resolver.js';
import {CalendarConnectionService} from './calendar-connection.service.js';
import {CALENDAR_CLIENT} from './calendar.types.js';
import {createCalendarClientFromEnv} from './google-calendar.client.js';
import {HostCalendarController} from './host-calendar.controller.js';
import {GoogleOAuthProvider, OAUTH_PROVIDER} from './oauth.provider.js';

@Module({
  controllers: [HostCalendarController],
  providers: [
    // The service account fallback, built once at startup; null when the env vars are missing or the key is invalid.
    {provide: CALENDAR_CLIENT, useFactory: () => createCalendarClientFromEnv(new Logger('CalendarModule'))},
    // The only code that calls Google's OAuth endpoints; tests swap it for a fake.
    {provide: OAUTH_PROVIDER, useClass: GoogleOAuthProvider},
    CalendarClientResolver,
    CalendarBusyService,
    CalendarConnectionService,
  ],
  exports: [CalendarBusyService],
})
export class CalendarModule {}
