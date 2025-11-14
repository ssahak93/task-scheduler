import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotifications1700000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET FOREIGN_KEY_CHECKS = 0`);

    await queryRunner.query(`
      CREATE TABLE \`notifications\` (
        \`id\` char(36) NOT NULL PRIMARY KEY,
        \`user_id\` char(36) NOT NULL,
        \`task_id\` char(36) NULL,
        \`type\` varchar(255) NOT NULL,
        \`message\` text NOT NULL,
        \`read\` tinyint(1) NOT NULL DEFAULT 0,
        \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX \`IDX_notifications_user_read\` (\`user_id\`, \`read\`),
        CONSTRAINT \`FK_notifications_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_notifications_task\` FOREIGN KEY (\`task_id\`) REFERENCES \`tasks\`(\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`SET FOREIGN_KEY_CHECKS = 1`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET FOREIGN_KEY_CHECKS = 0`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`notifications\``);
    await queryRunner.query(`SET FOREIGN_KEY_CHECKS = 1`);
  }
}



