import { Migration } from '@mikro-orm/migrations';

export class Migration20260207052626_createNotification extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create schema if not exists "notification";`);
    this.addSql(
      `create table "notification"."notification" ("id" serial primary key, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" varchar(255) null, "user_id" int not null, "title" varchar(255) not null, "message" varchar(255) not null, "is_read" boolean not null default false);`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "notification"."notification" cascade;`);

    this.addSql(`drop schema if exists "notification";`);
  }
}
