import { EntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { User } from './user.entity';

@Injectable()
export class UserRepository extends EntityRepository<User> {}
