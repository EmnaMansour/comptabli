import { Controller, Get, Patch, Post, Body, Request, UseGuards } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('admin/profile')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class AdminProfileController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getProfile(@Request() req: any) {
    return this.usersService.findById(req.user.userId);
  }

  @Patch()
  updateProfile(@Request() req: any, @Body() data: any) {
    return this.usersService.updateOwnAdminProfile(req.user.userId, data);
  }

  @Post('change-password')
  changePassword(@Request() req: any, @Body() data: any) {
    // Basic password change logic
    return this.usersService.resetPassword(req.user.userId, data.newPassword);
  }
}
