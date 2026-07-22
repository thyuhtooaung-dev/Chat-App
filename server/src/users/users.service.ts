import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async createUser(username: string, passwordPlain: string): Promise<User> {
    const existing = await this.userRepository.findOne({ where: { username } });
    if (existing) {
      throw new ConflictException('Username is already taken');
    }

    const hashedPassword = await bcrypt.hash(passwordPlain, 10);
    const user = this.userRepository.create({
      username,
      password: hashedPassword,
    });

    const saved = await this.userRepository.save(user);
    delete saved.password;
    return saved;
  }

  async findByUsernameWithPassword(username: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { username },
      select: { id: true, username: true, password: true, createdAt: true },
    });
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findAllUsers(): Promise<
    { id: string; username: string; createdAt: Date }[]
  > {
    return this.userRepository.find({
      select: { id: true, username: true, createdAt: true },
      order: { username: 'ASC' },
    });
  }
}
