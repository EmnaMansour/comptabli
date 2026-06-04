import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  UseGuards,
  Request,
  Body,
  Delete,
  Query,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role, Status } from '@prisma/client';

interface RequestWithUser extends Request {
  user: {
    userId: string;
    email: string;
    role: Role;
  };
}

@Controller('tasks')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  findAll(
    @Request() req: RequestWithUser,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('archived') archived?: string,
  ) {
    const isArchived = archived === 'true';
    return this.tasksService.findAll(
      req.user.userId, 
      req.user.role, 
      parseInt(page), 
      parseInt(limit),
      isArchived
    );
  }

  @Post()
  @Roles(Role.COMPTABLE, Role.ADMIN)
  create(
    @Body() body: {
      title: string;
      description?: string;
      priority: string;
      status?: Status;
      deadline?: string;
      clientDeadline?: string;
      assignedTo?: string[];
      clientId?: string;
      folderId?: string;
      requestId?: string;
      organizationId: string;
    },
    @Request() req: RequestWithUser,
  ) {
    const deadline = body.deadline && body.deadline.trim() !== '' ? new Date(body.deadline) : undefined;
    const clientDeadline = body.clientDeadline && body.clientDeadline.trim() !== '' ? new Date(body.clientDeadline) : undefined;

    return this.tasksService.create(
      {
        ...body,
        status: body.status || Status.PENDING,
        deadline: deadline && !isNaN(deadline.getTime()) ? deadline : undefined,
        clientDeadline: clientDeadline && !isNaN(clientDeadline.getTime()) ? clientDeadline : undefined,
      },
      req.user.userId,
    );
  }

  @Put(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: Status, rejectionReason?: string },
    @Request() req: RequestWithUser,
  ) {
    return this.tasksService.updateStatus(id, body.status, req.user.userId, req.user.role, body.rejectionReason);
  }

  @Post(':id/comments')
  addComment(
    @Param('id') id: string,
    @Body() body: { content: string },
    @Request() req: RequestWithUser,
  ) {
    return this.tasksService.addComment(id, body.content, req.user.userId);
  }

  @Post(':id/attachments')
  addAttachment(
    @Param('id') id: string,
    @Body() body: { name: string, url: string, size: number, type: string },
    @Request() req: RequestWithUser,
  ) {
    return this.tasksService.addAttachment(id, body, req.user.userId);
  }

  @Delete('attachments/:attId')
  deleteAttachment(
    @Param('attId') attId: string,
  ) {
    return this.tasksService.deleteAttachment(attId);
  }
}