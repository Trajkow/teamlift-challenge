import {Module} from '@nestjs/common';
import {HostSlotsController, PublicSlotsController} from './slots.controller.js';
import {SlotsService} from './slots.service.js';

@Module({
  controllers: [PublicSlotsController, HostSlotsController],
  providers: [SlotsService],
})
export class SlotsModule {}
