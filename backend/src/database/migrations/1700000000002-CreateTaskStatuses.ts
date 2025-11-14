import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTaskStatuses1700000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`task_statuses\` (
        \`id\` char(36) NOT NULL PRIMARY KEY,
        \`name\` varchar(255) NOT NULL,
        \`slug\` varchar(255) NOT NULL UNIQUE,
        \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`task_statuses\``);
  }
}



