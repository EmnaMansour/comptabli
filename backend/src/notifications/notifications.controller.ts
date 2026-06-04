import { Controller, Get, Patch, Post, Param, UseGuards, Request, Body } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from './notifications.service';

interface ReqUser {
  user: { userId: string };
}

@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@Request() req: ReqUser) {
    return this.notificationsService.findForUser(req.user.userId);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @Request() req: ReqUser) {
    return this.notificationsService.markRead(id, req.user.userId);
  }

  @Post('read-all')
  markAll(@Request() req: ReqUser) {
    return this.notificationsService.markAllRead(req.user.userId);
  }

  // --- Preferences ---
  @Get('preferences')
  getPreferences(@Request() req: ReqUser) {
    return this.notificationsService.getPreferences(req.user.userId);
  }

  @Patch('preferences')
  updatePreferences(@Request() req: ReqUser, @Body() data: any) {
    return this.notificationsService.updatePreferences(req.user.userId, data);
  }
}
