import { Migration } from '@mikro-orm/migrations';

export class Migration20260207053525_indexSong extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create index "song_title_trgm_idx" on "sayho"."song" using gin ("title" gin_trgm_ops);`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop index "sayho"."song_title_trgm_idx";`);
  }
}
