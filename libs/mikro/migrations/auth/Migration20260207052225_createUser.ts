import { Migration } from '@mikro-orm/migrations';

export class Migration20260207052225_createUser extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create schema if not exists "auth";`);
    this.addSql(
      `create table "auth"."user" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" varchar(255) null, "email" varchar(255) not null, "name" varchar(255) not null, "password" varchar(255) not null, "roles" text[] not null default '{user}', constraint "user_pkey" primary key ("id"));`,
    );
    this.addSql(`alter table "auth"."user" add constraint "user_email_unique" unique ("email");`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "auth"."user" cascade;`);

    this.addSql(`drop schema if exists "auth";`);
  }
}
