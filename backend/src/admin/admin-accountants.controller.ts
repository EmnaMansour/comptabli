import { Controller, Get, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role, Status } from '@prisma/client';

@Controller('admin/accountants')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class AdminAccountantsController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@Query('status') status?: Status, @Query('search') search?: string) {
    return this.usersService.findAllAdmin({ role: Role.COMPTABLE, status, search });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findAccountantDetails(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
