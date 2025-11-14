import { DataSource } from 'typeorm';
import { TaskStatus } from '../../entities/task-status.entity';

export async function seedStatuses(dataSource: DataSource) {
  const statusRepository = dataSource.getRepository(TaskStatus);

  const statuses = [
    { name: 'Pending', slug: 'pending' },
    { name: 'In Progress', slug: 'in-progress' },
    { name: 'Completed', slug: 'completed' },
    { name: 'Cancelled', slug: 'cancelled' },
  ];

  for (const statusData of statuses) {
    const existingStatus = await statusRepository.findOne({
      where: { slug: statusData.slug },
    });

    if (!existingStatus) {
      const status = statusRepository.create(statusData);
      await statusRepository.save(status);
      console.log(`Created status: ${statusData.name}`);
    }
  }
}



