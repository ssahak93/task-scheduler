import { AppDataSource } from '../data-source';
import { seedUsers } from './users.seed';
import { seedStatuses } from './statuses.seed';

export async function runSeeds() {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    console.log('Database connection established');

    await seedUsers(AppDataSource);
    await seedStatuses(AppDataSource);

    console.log('Seeding completed');
    await AppDataSource.destroy();
  } catch (error) {
    console.error('Error seeding database:', error);
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    process.exit(1);
  }
}

if (require.main === module) {
  require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
  runSeeds();
}

