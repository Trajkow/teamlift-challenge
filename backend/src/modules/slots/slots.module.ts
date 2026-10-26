import {Module} from '@nestjs/common';
import {AiModule} from '../ai/ai.module.js';
import {CalendarModule} from '../calendar/calendar.module.js';
import {BookingsController, HostSlotsController, PublicSlotsController} from './slots.controller.js';
import {SlotsService} from './slots.service.js';

@Module({
  imports: [AiModule, CalendarModule],
  controllers: [BookingsController, PublicSlotsController, HostSlotsController],
  providers: [SlotsService],
})
export class SlotsModule {}
