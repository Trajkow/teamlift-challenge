import {Module} from '@nestjs/common';
import {ConfirmationMessageService} from './confirmation-message.service.js';

@Module({
  providers: [ConfirmationMessageService],
  exports: [ConfirmationMessageService],
})
export class AiModule {}
