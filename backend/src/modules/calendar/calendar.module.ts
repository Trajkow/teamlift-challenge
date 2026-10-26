import {Logger, Module} from '@nestjs/common';
import {CalendarBusyService} from './calendar-busy.service.js';
import {CALENDAR_CLIENT} from './calendar.types.js';
import {createCalendarClientFromEnv} from './google-calendar.client.js';

@Module({
  providers: [
    // Built once at startup; null (feature off) when the env vars are missing or the key is invalid.
    {provide: CALENDAR_CLIENT, useFactory: () => createCalendarClientFromEnv(new Logger('CalendarModule'))},
    CalendarBusyService,
  ],
  exports: [CalendarBusyService],
})
export class CalendarModule {}
