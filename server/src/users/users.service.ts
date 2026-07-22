import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import * as bcrypt from 'bcryptjs';
import { UpdateProfileDto } from './dto/update-profile.dto';

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
    const colors = [
      '#3B82F6',
      '#8B5CF6',
      '#EC4899',
      '#10B981',
      '#F59E0B',
      '#6366F1',
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const user = this.userRepository.create({
      username,
      password: hashedPassword,
      avatarColor: randomColor,
      isOnline: true,
      lastSeen: new Date(),
    });

    const saved = await this.userRepository.save(user);
    delete saved.password;
    return saved;
  }

  async findByUsernameWithPassword(username: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { username },
      select: {
        id: true,
        username: true,
        password: true,
        bio: true,
        avatarColor: true,
        lastSeen: true,
        isOnline: true,
        createdAt: true,
      },
    });
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findAllUsers(): Promise<User[]> {
    const users = await this.userRepository.find({
      select: {
        id: true,
        username: true,
        bio: true,
        avatarColor: true,
        lastSeen: true,
        isOnline: true,
        createdAt: true,
      },
      order: { username: 'ASC' },
    });

    const now = new Date().getTime();
    return users.map((u) => {
      const isStale = u.lastSeen
        ? now - new Date(u.lastSeen).getTime() > 60000
        : true;
      return {
        ...u,
        isOnline: u.isOnline && !isStale,
      };
    });
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.findById(id);
    if (dto.bio !== undefined) user.bio = dto.bio;
    if (dto.avatarColor !== undefined) user.avatarColor = dto.avatarColor;
    return await this.userRepository.save(user);
  }

  async heartbeat(id: string): Promise<{ success: boolean; lastSeen: Date }> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.lastSeen = new Date();
    user.isOnline = true;
    await this.userRepository.save(user);
    return { success: true, lastSeen: user.lastSeen };
  }
}
