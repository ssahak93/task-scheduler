import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserAvailability1700000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET FOREIGN_KEY_CHECKS = 0`);

    await queryRunner.query(`
      CREATE TABLE \`user_availability\` (
        \`id\` char(36) NOT NULL PRIMARY KEY,
        \`user_id\` char(36) NOT NULL,
        \`task_id\` char(36) NULL,
        \`start_date\` date NOT NULL,
        \`end_date\` date NOT NULL,
        \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`IDX_user_availability_user_dates\` (\`user_id\`, \`start_date\`, \`end_date\`),
        CONSTRAINT \`FK_user_availability_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_user_availability_task\` FOREIGN KEY (\`task_id\`) REFERENCES \`tasks\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`SET FOREIGN_KEY_CHECKS = 1`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET FOREIGN_KEY_CHECKS = 0`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`user_availability\``);
    await queryRunner.query(`SET FOREIGN_KEY_CHECKS = 1`);
  }
}



