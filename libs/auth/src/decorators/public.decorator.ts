import { CustomDecorator, SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../auth.constant';

export const Public = (): CustomDecorator<symbol> => SetMetadata(IS_PUBLIC_KEY, true);
