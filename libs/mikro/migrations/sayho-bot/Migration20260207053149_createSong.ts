import { Migration } from '@mikro-orm/migrations';

export class Migration20260207053149_createSong extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create schema if not exists "sayho";`);
    this.addSql(
      `create table "sayho"."song" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" varchar(255) null, "url" text not null, "title" text not null, "count" int not null default 0, constraint "song_pkey" primary key ("id"));`,
    );

    this.addSql(`drop table if exists "auth"."migrations" cascade;`);

    this.addSql(`drop table if exists "notification"."migrations" cascade;`);

    this.addSql(`drop table if exists "notification"."notification" cascade;`);

    this.addSql(`drop table if exists "auth"."user" cascade;`);

    this.addSql(`drop schema if exists "auth";`);
    this.addSql(`drop schema if exists "notification";`);
  }

  override async down(): Promise<void> {
    this.addSql(`create schema if not exists "auth";`);
    this.addSql(`create schema if not exists "notification";`);
    this.addSql(
      `create table "auth"."migrations" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`,
    );

    this.addSql(
      `create table "notification"."migrations" ("id" serial primary key, "name" varchar(255) null, "executed_at" timestamptz(6) null default CURRENT_TIMESTAMP);`,
    );

    this.addSql(
      `create table "notification"."notification" ("id" serial primary key, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" varchar(255) null, "user_id" int4 not null, "title" varchar(255) not null, "message" varchar(255) not null, "is_read" bool not null default false);`,
    );

    this.addSql(
      `create table "auth"."user" ("id" uuid not null, "created_at" timestamptz(6) not null, "updated_at" timestamptz(6) not null, "deleted_at" varchar(255) null, "email" varchar(255) not null, "name" varchar(255) not null, "password" varchar(255) not null, "roles" text[] not null default '{user}', constraint "user_pkey" primary key ("id"));`,
    );
    this.addSql(`alter table "auth"."user" add constraint "user_email_unique" unique ("email");`);

    this.addSql(`drop table if exists "sayho"."song" cascade;`);

    this.addSql(`drop schema if exists "sayho";`);
  }
}
