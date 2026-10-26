import {Module} from '@nestjs/common';
import {ConfirmationMessageService, GENAI_CLIENT} from './confirmation-message.service.js';

@Module({
  // GENAI_CLIENT is null in the app (the service builds a real client from env); tests override it with a fake.
  providers: [ConfirmationMessageService, {provide: GENAI_CLIENT, useValue: null}],
  exports: [ConfirmationMessageService],
})
export class AiModule {}
