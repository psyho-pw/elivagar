import { SetMetadata } from '@nestjs/common';
import { BYPASS_RESPONSE_INTERCEPTOR } from './response.constant';

export const BypassResponseInterceptor = () => SetMetadata(BYPASS_RESPONSE_INTERCEPTOR, true);
