import { ConfigsService as CoreConfigsService } from '@app/core/configs/configs.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ConfigsService extends CoreConfigsService {}
