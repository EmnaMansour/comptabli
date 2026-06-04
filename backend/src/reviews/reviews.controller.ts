import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Request, HttpCode } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role, Status } from '@prisma/client';

@Controller('reviews')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /**
   * Crée un nouvel avis (client → comptable)
   * Vérifie que le client a une relation active avec le comptable
   */
  @Post()
  @Roles(Role.CLIENT)
  @HttpCode(201)
  create(
    @Body() body: { accountantId: string; rating: number; comment?: string },
    @Request() req: any,
  ) {
    return this.reviewsService.createReview(
      req.user.userId || req.user.id,
      body.accountantId,
      body.rating,
      body.comment,
    );
  }

  /**
   * Récupère les avis laissés par le client
   */
  @Get('my-reviews')
  @Roles(Role.CLIENT)
  findClientReviews(@Request() req: any) {
    return this.reviewsService.findClientReviews(req.user.userId || req.user.id);
  }

  /**
   * Récupère (comme comptable) les avis approuvés reçus
   */
  @Get('my-accountant-reviews')
  @Roles(Role.COMPTABLE)
  findAccountantReviews(@Request() req: any) {
    return this.reviewsService.findAccountantReviews(req.user.userId || req.user.id);
  }

  /**
   * Admin : liste tous les avis avec statut
   */
  @Get('admin/all')
  @Roles(Role.ADMIN)
  findAllAdmin(@Query('status') status?: Status) {
    return this.reviewsService.findAllAdmin(status);
  }

  /**
   * Admin : approuve un avis (devient visible sur la fiche networking)
   */
  @Patch('admin/:id/approve')
  @Roles(Role.ADMIN)
  @HttpCode(200)
  approveReview(@Param('id') id: string) {
    return this.reviewsService.approveReview(id);
  }

  /**
   * Admin : change le statut d'un avis
   */
  @Patch('admin/:id/status')
  @Roles(Role.ADMIN)
  updateStatus(@Param('id') id: string, @Body('status') status: Status) {
    return this.reviewsService.updateStatus(id, status);
  }

  /**
   * Admin : supprime un avis
   */
  @Delete('admin/:id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.reviewsService.remove(id);
  }
}
