import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../entities/user.entity';

export async function seedUsers(dataSource: DataSource) {
  const userRepository = dataSource.getRepository(User);

  const adminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
  const managerPassword = await bcrypt.hash(process.env.MANAGER_PASSWORD || 'manager123', 10);
  const userPassword = await bcrypt.hash(process.env.USER_PASSWORD || 'user123', 10);

  const users = [
    {
      email: 'admin@task.com',
      password: adminPassword,
      name: 'Admin User',
      isAdmin: true,
    },
    {
      email: 'manager@task.com',
      password: managerPassword,
      name: 'Manager User',
      isAdmin: false,
    },
    {
      email: 'user1@task.com',
      password: userPassword,
      name: 'John Doe',
      isAdmin: false,
    },
    {
      email: 'user2@task.com',
      password: userPassword,
      name: 'Jane Smith',
      isAdmin: false,
    },
    {
      email: 'user3@task.com',
      password: userPassword,
      name: 'Bob Johnson',
      isAdmin: false,
    },
  ];

  for (const userData of users) {
    const existingUser = await userRepository.findOne({
      where: { email: userData.email },
    });

    if (!existingUser) {
      const user = userRepository.create(userData);
      await userRepository.save(user);
      console.log(`Created user: ${userData.email}`);
    }
  }
}

