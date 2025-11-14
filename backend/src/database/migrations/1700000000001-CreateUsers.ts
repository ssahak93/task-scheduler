import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1700000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`users\` (
        \`id\` char(36) NOT NULL PRIMARY KEY,
        \`email\` varchar(255) NOT NULL UNIQUE,
        \`password\` varchar(255) NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`isAdmin\` boolean NOT NULL DEFAULT false,
        \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`users\``);
  }
}



