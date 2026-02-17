import { Migration } from '@mikro-orm/migrations';

export class Migration20260216000000_changeIdToUuidAndAddType extends Migration {
  override async up(): Promise<void> {
    // Add type column
    this.addSql(
      `alter table "notification"."notification" add column "type" text check ("type" in ('SYSTEM', 'AUTH', 'INFO')) not null default 'INFO';`,
    );

    // Convert id from serial to uuid
    this.addSql(`alter table "notification"."notification" drop constraint "notification_pkey";`);
    this.addSql(`alter table "notification"."notification" alter column "id" drop default;`);
    this.addSql(
      `alter table "notification"."notification" alter column "id" type uuid using gen_random_uuid();`,
    );
    this.addSql(
      `alter table "notification"."notification" add constraint "notification_pkey" primary key ("id");`,
    );

    // Fix deleted_at type from varchar to timestamptz
    this.addSql(
      `alter table "notification"."notification" alter column "deleted_at" type timestamptz using "deleted_at"::timestamptz;`,
    );
  }

  override async down(): Promise<void> {
    // Revert deleted_at type
    this.addSql(
      `alter table "notification"."notification" alter column "deleted_at" type varchar(255);`,
    );

    // Revert id from uuid back to serial
    this.addSql(`alter table "notification"."notification" drop constraint "notification_pkey";`);
    this.addSql(`alter table "notification"."notification" alter column "id" type serial;`);
    this.addSql(
      `alter table "notification"."notification" add constraint "notification_pkey" primary key ("id");`,
    );

    // Drop type column
    this.addSql(`alter table "notification"."notification" drop column "type";`);
  }
}
