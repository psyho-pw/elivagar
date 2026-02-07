import { Migration } from '@mikro-orm/migrations';

export class Migration20260207100000_addTrgmIndexToSongTitle extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create extension if not exists "pg_trgm";`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop extension if exists "pg_trgm";`);
  }
}
