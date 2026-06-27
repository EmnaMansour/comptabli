import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { Role, Status } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminService } from './admin.service';

type AdminRequest = Request & {
  user: {
    userId: string;
    email: string;
    role: Role;
  };
};

@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) { }

  private actor(req: AdminRequest) {
    return {
      userId: req.user.userId,
      email: req.user.email,
      role: req.user.role,
      ip: req.ip,
    };
  }

  @Get('dashboard')
  getDashboard(@Req() req: AdminRequest) {
    return this.adminService.getDashboard(this.actor(req));
  }

  @Get('accountants')
  listAccountants(
    @Req() req: AdminRequest,
    @Query('status') status?: Status,
    @Query('search') search?: string,
  ) {
    return this.adminService.listAccountants(this.actor(req), { status, search });
  }

  @Get('accountants/:id')
  getAccountant(@Req() req: AdminRequest, @Param('id') id: string) {
    return this.adminService.getAccountant(this.actor(req), id);
  }

  @Delete('accountants/:id')
  deleteAccountant(@Req() req: AdminRequest, @Param('id') id: string) {
    return this.adminService.deleteAccountant(this.actor(req), id);
  }

  @Get('users')
  listUsers(
    @Req() req: AdminRequest,
    @Query('role') role?: Role,
    @Query('status') status?: Status,
    @Query('search') search?: string,
  ) {
    return this.adminService.listUsers(this.actor(req), { role, status, search });
  }

  @Post('users')
  createUser(
    @Req() req: AdminRequest,
    @Body()
    body: {
      email: string;
      firstName: string;
      lastName: string;
      companyName?: string;
      phone?: string;
      birthDate?: string;
      experienceLevel?: string;
      hireDate?: string;
      cinUrl?: string;
      diplomaUrl?: string;
      password?: string;
      role: Role;
      status?: Status;
    },
  ) {
    return this.adminService.createUser(this.actor(req), body);
  }

  @Get('users/:id')
  getUser(@Req() req: AdminRequest, @Param('id') id: string) {
    return this.adminService.getUser(this.actor(req), id);
  }

  @Patch('users/:id')
  updateUser(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @Body()
    body: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      companyName?: string;
      accountantId?: string;
    },
  ) {
    return this.adminService.updateUser(this.actor(req), id, body);
  }

  @Patch('users/:id/status')
  updateUserStatus(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @Body('status') status: Status,
  ) {
    return this.adminService.updateUserStatus(this.actor(req), id, status);
  }

  @Patch('users/:id/role')
  updateUserRole(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @Body('role') role: Role,
  ) {
    return this.adminService.updateUserRole(this.actor(req), id, role);
  }

  @Post('users/:id/reset-password')
  resetUserPassword(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @Body('password') password?: string,
  ) {
    return this.adminService.resetUserPassword(this.actor(req), id, password);
  }

  @Delete('users/:id')
  deleteUser(@Req() req: AdminRequest, @Param('id') id: string) {
    return this.adminService.deleteUser(this.actor(req), id);
  }

  @Get('reviews')
  listReviews(@Req() req: AdminRequest, @Query('status') status?: Status) {
    return this.adminService.listReviews(this.actor(req), status);
  }

  @Patch('reviews/:id/status')
  updateReviewStatus(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @Body('status') status: Status,
  ) {
    return this.adminService.updateReviewStatus(this.actor(req), id, status);
  }

  @Delete('reviews/:id')
  deleteReview(@Req() req: AdminRequest, @Param('id') id: string) {
    return this.adminService.deleteReview(this.actor(req), id);
  }

  @Get('storage')
  listStorage(@Req() req: AdminRequest) {
    return this.adminService.listStorage(this.actor(req));
  }

  @Patch('storage/:organizationId/quota')
  updateStorageQuota(
    @Req() req: AdminRequest,
    @Param('organizationId') organizationId: string,
    @Body('limit') limit: number,
  ) {
    return this.adminService.updateStorageQuota(this.actor(req), organizationId, Number(limit));
  }

  @Get('analytics')
  getAnalytics(@Req() req: AdminRequest) {
    return this.adminService.getAnalytics(this.actor(req));
  }

  @Get('audit-logs')
  listAuditLogs(
    @Req() req: AdminRequest,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.adminService.listAuditLogs(this.actor(req), {
      userId,
      action,
      entity,
      from,
      to,
    });
  }

  @Get('audit-logs/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportAuditLogs(
    @Req() req: AdminRequest,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.adminService.exportAuditLogsCsv(this.actor(req), {
      userId,
      action,
      entity,
      from,
      to,
    });
  }

  @Get('profile')
  getProfile(@Req() req: AdminRequest) {
    return this.adminService.getProfile(this.actor(req));
  }

  @Patch('profile')
  updateProfile(
    @Req() req: AdminRequest,
    @Body()
    body: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      companyName?: string;
    },
  ) {
    return this.adminService.updateProfile(this.actor(req), body);
  }

  @Post('profile/change-password')
  changePassword(
    @Req() req: AdminRequest,
    @Body() body: { currentPassword?: string; newPassword?: string },
  ) {
    return this.adminService.changePassword(this.actor(req), body);
  }
}
