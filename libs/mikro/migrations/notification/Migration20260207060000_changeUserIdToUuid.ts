import { Migration } from '@mikro-orm/migrations';

export class Migration20260207060000_changeUserIdToUuid extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "notification"."notification" alter column "user_id" type uuid using "user_id"::text::uuid;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "notification"."notification" alter column "user_id" type int using null;`,
    );
  }
}
