import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsDateString,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsOptional() // Might be optional if randomly generated for invite
  @MinLength(6)
  password?: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  experienceLevel?: string;

  @IsOptional()
  @IsDateString()
  hireDate?: string;

  @IsOptional()
  @IsString()
  cinUrl?: string;

  @IsOptional()
  @IsString()
  diplomaUrl?: string;

  @IsOptional()
  role?: any;

  @IsOptional()
  status?: any;

  @IsOptional()
  @IsString()
  accountantId?: string;

  @IsOptional()
  @IsString()
  activitySector?: string;

  @IsOptional()
  @IsString()
  patenteUrl?: string;

  @IsOptional()
  @IsString()
  rneUrl?: string;
}
