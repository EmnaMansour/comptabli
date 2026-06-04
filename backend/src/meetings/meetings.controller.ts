import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role, Status } from '@prisma/client';

@Controller('meetings')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Post()
  @Roles(Role.COMPTABLE, Role.ADMIN, Role.CLIENT)
  create(@Body() body: any, @Request() req: any) {
    const scheduledAt = new Date(body.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Date/heure invalide');
    }
    const duration = Number(body.duration) > 0 ? Number(body.duration) : 30;

    if (req.user.role === Role.CLIENT) {
      return this.meetingsService.create({
        title: body.title,
        type: body.type ?? 'VIRTUAL',
        scheduledAt,
        duration,
        clientId: req.user.userId,
        accountantId: body.accountantId ?? null,
        meetingLink: body.meetingLink ?? null,
        subject: body.subject,
        description: body.description,
        color: body.color,
        locationDetail: body.locationDetail,
        guests: body.guests,
        creatorId: req.user.userId,
      });
    }

    if (!body.clientId) {
      throw new BadRequestException('clientId requis');
    }

    const accountantId =
      req.user.role === Role.ADMIN ? (body.accountantId ?? req.user.userId) : req.user.userId;

    return this.meetingsService.create({
      title: body.title,
      type: body.type ?? 'VIRTUAL',
      scheduledAt,
      duration,
      clientId: body.clientId ?? req.user.userId,
      accountantId,
      meetingLink: body.meetingLink ?? null,
      subject: body.subject,
      description: body.description,
      color: body.color,
      locationDetail: body.locationDetail,
      guests: body.guests,
      creatorId: req.user.userId,
    });
  }

  @Get('availability')
  getAvailability(@Request() req: any) {
    return this.meetingsService.getAvailability(req.user.userId);
  }

  @Patch('availability')
  @Roles(Role.COMPTABLE, Role.COLLABORATEUR, Role.ADMIN)
  updateAvailability(@Body('slots') slots: any[], @Request() req: any) {
    return this.meetingsService.updateAvailability(req.user.userId, slots);
  }

  @Get('available-slots/:accountantId')
  @Roles(Role.CLIENT, Role.COMPTABLE, Role.COLLABORATEUR, Role.ADMIN)
  getAvailableSlots(
    @Param('accountantId') accountantId: string,
    @Query('year') yearStr: string,
    @Query('month') monthStr: string,
  ) {
    const now = new Date();
    const year = Number(yearStr) || now.getFullYear();
    const month = Number(monthStr) || now.getMonth() + 1;
    return this.meetingsService.getAvailableSlots(accountantId, year, month);
  }

  @Patch(':id/pv')
  @Roles(Role.COMPTABLE, Role.COLLABORATEUR, Role.ADMIN)
  setPV(@Param('id') id: string, @Body('pvUrl') pvUrl: string, @Request() req: any) {
    return this.meetingsService.setPV(id, req.user.userId, req.user.role, pvUrl);
  }

  @Get()
  findAll(@Request() req: any) {
    return this.meetingsService.findAll(req.user.userId, req.user.role);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.meetingsService.findOne(id, req.user.userId, req.user.role);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    if (body.scheduledAt) {
      body.scheduledAt = new Date(body.scheduledAt);
      if (Number.isNaN(body.scheduledAt.getTime())) {
        throw new BadRequestException('Date/heure invalide');
      }
    }
    return this.meetingsService.update(id, req.user.userId, req.user.role, body);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: Status,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    return this.meetingsService.updateStatus(id, req.user.userId, req.user.role, status, reason);
  }

  @Post(':id/notes')
  addNote(@Param('id') id: string, @Body('content') content: string, @Request() req: any) {
    return this.meetingsService.addNote(id, req.user.userId, content);
  }

  @Post(':id/actions')
  addAction(@Param('id') id: string, @Body() body: any) {
    return this.meetingsService.addAction(id, body.description, body.assignedTo, body.dueDate);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.meetingsService.remove(id, req.user.userId, req.user.role);
  }
}
