import { Controller, Get, Param } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getAllUsers() {
    return this.usersService.findAllUsers();
  }

  @Get(':id')
  async getUserById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
