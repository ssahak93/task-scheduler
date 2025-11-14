import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTasks1700000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET FOREIGN_KEY_CHECKS = 0`);

    await queryRunner.query(`
      CREATE TABLE \`tasks\` (
        \`id\` char(36) NOT NULL PRIMARY KEY,
        \`title\` varchar(255) NOT NULL,
        \`description\` text NULL,
        \`startDate\` date NOT NULL,
        \`endDate\` date NOT NULL,
        \`assigned_user_id\` char(36) NOT NULL,
        \`status_id\` char(36) NOT NULL,
        \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`IDX_tasks_dates\` (\`startDate\`, \`endDate\`),
        INDEX \`IDX_tasks_assigned_user\` (\`assigned_user_id\`),
        INDEX \`IDX_tasks_status\` (\`status_id\`),
        FULLTEXT INDEX \`IDX_tasks_title\` (\`title\`),
        CONSTRAINT \`FK_tasks_assigned_user\` FOREIGN KEY (\`assigned_user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_tasks_status\` FOREIGN KEY (\`status_id\`) REFERENCES \`task_statuses\`(\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`SET FOREIGN_KEY_CHECKS = 1`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET FOREIGN_KEY_CHECKS = 0`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`tasks\``);
    await queryRunner.query(`SET FOREIGN_KEY_CHECKS = 1`);
  }
}



