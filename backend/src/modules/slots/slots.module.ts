import {Module} from '@nestjs/common';
import {AiModule} from '../ai/ai.module.js';
import {BookingsController, HostSlotsController, PublicSlotsController} from './slots.controller.js';
import {SlotsService} from './slots.service.js';

@Module({
  imports: [AiModule],
  controllers: [BookingsController, PublicSlotsController, HostSlotsController],
  providers: [SlotsService],
})
export class SlotsModule {}
