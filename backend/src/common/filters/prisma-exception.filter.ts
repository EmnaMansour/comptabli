import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Erreurs Prisma → HTTP lisibles (évite un 500 générique « Internal server error »). */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaKnownRequestExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const dev = process.env.NODE_ENV !== 'production';

    if (exception.code === 'P2002') {
      return res.status(409).json({
        statusCode: 409,
        message: 'Cette adresse e-mail est déjà utilisée.',
      });
    }

    const message = dev
      ? `[Prisma ${exception.code}] ${exception.message}`
      : 'Requête invalide ou conflit avec la base de données.';

    return res.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message,
    });
  }
}

@Catch(Prisma.PrismaClientValidationError)
export class PrismaValidationExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientValidationError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const dev = process.env.NODE_ENV !== 'production';
    return res.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message: dev ? exception.message : 'Données invalides.',
    });
  }
}
