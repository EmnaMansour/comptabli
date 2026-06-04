import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role, Status } from '@prisma/client';

@Controller('admin/users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(
    @Query('role') role?: Role,
    @Query('status') status?: Status,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAllAdmin({ role, status, search });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    // Note: Admin can create users directly. 
    // We reuse the existing service method.
    return this.usersService.create(
      createUserDto,
      createUserDto.role || Role.CLIENT,
      createUserDto.status || Status.ACTIVE,
      createUserDto.accountantId
    );
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateData: any) {
    // Generic update for admin (names, email, etc.)
    return this.usersService.updateAdminInfo(id, updateData);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: Status) {
    return this.usersService.updateStatus(id, status);
  }

  @Patch(':id/role')
  updateRole(@Param('id') id: string, @Body('role') role: Role) {
    return this.usersService.updateRole(id, role);
  }

  @Post(':id/reset-password')
  resetPassword(@Param('id') id: string, @Body('password') password?: string) {
    return this.usersService.resetPassword(id, password);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
