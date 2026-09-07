import {sqliteTable,text} from 'drizzle-orm/sqlite-core';
export const records=sqliteTable('estate_records',{id:text('id').primaryKey(),payload:text('payload').notNull(),updated:text('updated').notNull()});
export const preferences=sqliteTable('estate_preferences',{owner:text('owner').primaryKey(),payload:text('payload').notNull()});
