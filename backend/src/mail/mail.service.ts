import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService implements OnModuleInit {
  private transporter: nodemailer.Transporter | null = null;
  private readonly logger = new Logger(MailService.name);
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.from =
      this.config.get<string>('MAIL_FROM')?.trim() ||
      '"Comptabli" <noreply@example.com>';
  }

  onModuleInit() {
    this.buildTransporter();
  }

  private buildTransporter() {
    const host = this.config.get<string>('SMTP_HOST')?.trim();
    const user = this.config.get<string>('SMTP_USER')?.trim();
    const pass =
      this.config.get<string>('SMTP_PASS')?.trim() ||
      this.config.get<string>('SMTP_PASSWORD')?.trim();

    const portRaw = this.config.get<string>('SMTP_PORT');
    const port = portRaw ? parseInt(portRaw, 10) : 587;
    if (Number.isNaN(port)) {
      this.logger.error('SMTP_PORT invalide');
      return;
    }

    const secureEnv = this.config.get<string>('SMTP_SECURE')?.toLowerCase();
    const secure = secureEnv === 'true' || secureEnv === '1' || port === 465;

    if (!host || !user || !pass) {
      this.logger.warn(
        'SMTP non configure : renseignez SMTP_HOST, SMTP_USER et SMTP_PASS (ou SMTP_PASSWORD) dans .env pour envoyer des e-mails reels.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    this.logger.log(`SMTP pret (${host}:${port}, secure=${secure})`);
  }

  getFrontendBaseUrl(): string {
    return (
      this.config.get<string>('FRONTEND_URL')?.replace(/\/$/, '').trim() || 'http://localhost:5173'
    );
  }

  async sendMail(to: string, subject: string, text: string, html?: string, attachments?: any[]) {
    if (process.env.NODE_ENV === 'test') return true;
    if (!this.transporter) {
      this.logger.warn(
        'Aucun transporteur SMTP : e-mail non envoye. Definissez SMTP_HOST, SMTP_USER et SMTP_PASS dans backend/.env (voir .env.example).',
      );
      return false;
    }
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        text,
        html: html ?? text.replace(/\n/g, '<br/>'),
        attachments,
      });
      this.logger.log(`E-mail envoye a ${to} (messageId=${info.messageId})`);
      return true;
    } catch (e) {
      this.logger.error(`Echec envoi e-mail a ${to}`, e);
      return false;
    }
  }

  async sendActivationEmail(
    to: string,
    role: string,
    credentials?: { email?: string; temporaryPassword?: string },
  ): Promise<{ sent: boolean }> {
    const subject = 'Comptabli - Bienvenue sur votre compte';
    const loginUrl = `${this.getFrontendBaseUrl()}/login`;
    const logoPath = join(process.cwd(), '../frontend/public/comptabli-logo.png');
    
    const credentialsHtml = credentials?.temporaryPassword
      ? `<div style="text-align: left; background: #f8fafc; padding: 20px; border-radius: 8px; margin-top: 24px; border: 1px solid #e2e8f0; max-width: 300px; margin-left: auto; margin-right: auto;">
           <p style="margin: 0; font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase;">Vos identifiants de connexion</p>
           <p style="margin: 10px 0 5px 0; font-size: 14px; color: #0f172a;"><strong>E-mail :</strong> ${credentials.email ?? to}</p>
           <p style="margin: 0; font-size: 14px; color: #0f172a;"><strong>Mot de passe :</strong> ${credentials.temporaryPassword}</p>
         </div>`
      : '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
          <style>
              body { margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
              .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.02); border: 1px solid #e4e4e7; }
              .header { text-align: center; padding: 40px 20px 0px; }
              .logo { font-size: 28px; font-weight: 800; color: #2563eb; letter-spacing: -0.5px; margin: 0; }
              .content { padding: 40px; text-align: center; }
              .title { font-size: 20px; font-weight: 800; color: #09090b; margin-bottom: 12px; }
              .text { font-size: 14px; color: #52525b; line-height: 1.5; margin-bottom: 24px; }
              .btn { display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600; padding: 14px 32px; border-radius: 8px; font-size: 15px; margin-top: 10px; margin-bottom: 10px; border: none; }
              .footer { text-align: center; padding: 30px; font-size: 12px; color: #a1a1aa; background-color: #f4f4f5; }
              .socials { margin-bottom: 15px; }
              .socials span { display: inline-block; margin: 0 5px; width: 28px; height: 28px; border-radius: 50%; background: #e4e4e7; line-height: 28px; color: #3f3f46; font-weight: bold; font-size: 11px; }
          </style>
      </head>
      <body>
          <div style="background-color: #f4f4f5; padding: 40px 20px;">
              <div class="header">
                  <img src="cid:logo" alt="COMPTABLI" height="36" style="display: block; margin: 0 auto; max-width: 100%; border: none; outline: none;" />
              </div>
              <div class="container">
                  <div class="content">
                      <h2 class="title">Bienvenue sur votre compte !</h2>
                      <p class="text">
                          Votre espace de travail Comptabli a été créé avec le rôle de <strong>${role}</strong>.<br/><br/>
                          Cliquez sur le bouton ci-dessous pour vous connecter et commencer à gérer vos missions.
                      </p>
                      
                      <a href="${loginUrl}" class="btn" style="color: #ffffff;">Me connecter à mon espace</a>
                      
                      ${credentialsHtml}
                  </div>
              </div>
              <div class="footer">
                  <div class="socials">
                      <span>f</span> <span>in</span> <span>ig</span>
                  </div>
                  Copyright © ${new Date().getFullYear()} COMPTABLI. All rights reserved.
              </div>
          </div>
      </body>
      </html>
    `;

    const text = `Bonjour, Votre compte a été créé avec le rôle ${role}. Mot de passe temporaire: ${credentials?.temporaryPassword}`;
    const sent = await this.sendMail(to, subject, text, html, [{ filename: 'logo.png', path: logoPath, cid: 'logo' }]);
    return { sent };
  }


  async sendRegistrationVerificationEmail(
    to: string,
    plainToken: string,
    role: string,
  ): Promise<{ sent: boolean; devPreviewUrl?: string }> {
    const verifyUrl = `${this.getFrontendBaseUrl()}/verify-email?token=${encodeURIComponent(plainToken)}`;
    const subject = 'Comptabli - Confirmez votre adresse e-mail';
    const text = `Bonjour,

Merci de vous etre inscrit sur Comptabli (role : ${role}).

Pour activer votre compte et confirmer votre e-mail, ouvrez ce lien dans votre navigateur (valide 48 h) :
${verifyUrl}

Si vous n'etes pas a l'origine de cette inscription, ignorez ce message.

L'equipe Comptabli`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
          <style>
              body { margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
              .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.02); border: 1px solid #e4e4e7; }
              .header { text-align: center; padding: 40px 20px 0px; }
              .logo { font-size: 28px; font-weight: 800; color: #2563eb; letter-spacing: -0.5px; margin: 0; }
              .content { padding: 40px; text-align: center; }
              .title { font-size: 20px; font-weight: 800; color: #09090b; margin-bottom: 12px; }
              .text { font-size: 14px; color: #52525b; line-height: 1.5; margin-bottom: 24px; }
              .btn { display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600; padding: 14px 32px; border-radius: 8px; font-size: 15px; margin-top: 10px; margin-bottom: 10px; border: none; }
              .footer { text-align: center; padding: 30px; font-size: 12px; color: #a1a1aa; background-color: #f4f4f5; }
              .socials { margin-bottom: 15px; }
              .socials span { display: inline-block; margin: 0 5px; width: 28px; height: 28px; border-radius: 50%; background: #e4e4e7; line-height: 28px; color: #3f3f46; font-weight: bold; font-size: 11px; }
          </style>
      </head>
      <body>
          <div style="background-color: #f4f4f5; padding: 40px 20px;">
              <div class="header">
                  <img src="cid:logo" alt="COMPTABLI" height="36" style="display: block; margin: 0 auto; max-width: 100%; border: none; outline: none;" />
              </div>
              <div class="container">
                  <div class="content">
                      <h2 class="title">Vérification de votre compte</h2>
                      <p class="text">
                          Merci de vous être inscrit sur Comptabli (rôle : <strong>${role}</strong>).<br/><br/>
                          Pour activer votre compte et confirmer votre adresse e-mail, cliquez sur le bouton ci-dessous (valide pendant 48 heures) :
                      </p>
                      
                      <a href="${verifyUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600; padding: 14px 32px; border-radius: 8px; font-size: 15px; margin: 10px 0;">Confirmer mon e-mail</a>
                      
                      <p style="font-size: 11px; color: #a1a1aa; margin-top: 20px; word-break: break-all;">Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br/><a href="${verifyUrl}" style="color: #2563eb;">${verifyUrl}</a></p>
                      
                      <p style="font-size: 12px; color: #a1a1aa; margin-top: 16px;">Si vous n'êtes pas à l'origine de cette inscription, ignorez simplement ce message.</p>
                  </div>
              </div>
              <div class="footer">
                  <div class="socials">
                      <span>f</span> <span>in</span> <span>ig</span>
                  </div>
                  Copyright © ${new Date().getFullYear()} COMPTABLI. All rights reserved.
              </div>
          </div>
      </body>
      </html>
    `;
    this.logger.log(`[VERIFICATION EMAIL] Pour: ${to} | Lien: ${verifyUrl}`);
    const logoPath = join(process.cwd(), '../frontend/public/comptabli-logo.png');
    const sent = await this.sendMail(to, subject, text, html, [{ filename: 'logo.png', path: logoPath, cid: 'logo' }]);
    if (!sent) {
      this.logger.warn(
        `[E-mail non envoye - SMTP absent] Lien de verification pour ${to} : ${verifyUrl}`,
      );
      return { sent: false, devPreviewUrl: verifyUrl };
    }
    return { sent: true };
  }

  async sendPasswordResetEmail(to: string, plainToken: string): Promise<{ sent: boolean; devPreviewUrl?: string }> {
    const resetUrl = `${this.getFrontendBaseUrl()}/reset-password?token=${encodeURIComponent(plainToken)}`;
    const subject = 'Comptabli - Réinitialisation de votre mot de passe';
    const text = `Bonjour,

Vous avez demandé la réinitialisation de votre mot de passe sur Comptabli.

Cliquez sur ce lien pour choisir un nouveau mot de passe (valide 1 heure) :
${resetUrl}

Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.

L'équipe Comptabli`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
          <style>
              body { margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
              .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.02); border: 1px solid #e4e4e7; }
              .header { text-align: center; padding: 40px 20px 0px; }
              .content { padding: 40px; text-align: center; }
              .title { font-size: 20px; font-weight: 800; color: #09090b; margin-bottom: 12px; }
              .text { font-size: 14px; color: #52525b; line-height: 1.5; margin-bottom: 24px; }
              .footer { text-align: center; padding: 30px; font-size: 12px; color: #a1a1aa; background-color: #f4f4f5; }
              .socials { margin-bottom: 15px; }
              .socials span { display: inline-block; margin: 0 5px; width: 28px; height: 28px; border-radius: 50%; background: #e4e4e7; line-height: 28px; color: #3f3f46; font-weight: bold; font-size: 11px; }
          </style>
      </head>
      <body>
          <div style="background-color: #f4f4f5; padding: 40px 20px;">
              <div class="header">
                  <img src="cid:logo" alt="COMPTABLI" height="36" style="display: block; margin: 0 auto; max-width: 100%; border: none; outline: none;" />
              </div>
              <div class="container">
                  <div class="content">
                      <h2 class="title">Réinitialisation du mot de passe</h2>
                      <p class="text">
                          Vous avez demandé la réinitialisation de votre mot de passe.<br/><br/>
                          Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe (valide pendant 1 heure) :
                      </p>
                      
                      <a href="${resetUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600; padding: 14px 32px; border-radius: 8px; font-size: 15px; margin: 10px 0;">Réinitialiser mon mot de passe</a>
                      
                      <p style="font-size: 11px; color: #a1a1aa; margin-top: 20px; word-break: break-all;">Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br/><a href="${resetUrl}" style="color: #2563eb;">${resetUrl}</a></p>
                      
                      <p style="font-size: 12px; color: #a1a1aa; margin-top: 16px;">Si vous n'êtes pas à l'origine de cette demande, ignorez simplement ce message.</p>
                  </div>
              </div>
              <div class="footer">
                  <div class="socials">
                      <span>f</span> <span>in</span> <span>ig</span>
                  </div>
                  Copyright © ${new Date().getFullYear()} COMPTABLI. All rights reserved.
              </div>
          </div>
      </body>
      </html>
    `;
    this.logger.log(`[PASSWORD RESET EMAIL] Pour: ${to} | Lien: ${resetUrl}`);
    const logoPath = join(process.cwd(), '../frontend/public/comptabli-logo.png');
    const sent = await this.sendMail(to, subject, text, html, [{ filename: 'logo.png', path: logoPath, cid: 'logo' }]);
    if (!sent) {
      this.logger.warn(`[E-mail non envoye - SMTP absent] Lien de réinitialisation pour ${to} : ${resetUrl}`);
      return { sent: false, devPreviewUrl: resetUrl };
    }
    return { sent: true };
  }
  async sendMeetingInviteEmail(
    to: string,
    meeting: {
      title: string;
      date: string;
      time: string;
      duration: number;
      type: string;
      organizerName: string;
      locationDetail?: string;
      meetingLink?: string;
    },
  ): Promise<{ sent: boolean }> {
    const subject = `Comptabli - Invitation : ${meeting.title}`;
    const loginUrl = `${this.getFrontendBaseUrl()}/login`;
    const logoPath = join(process.cwd(), '../frontend/public/comptabli-logo.png');

    const typeLabel =
      meeting.type === 'VIRTUAL' ? '💻 Visioconférence'
      : meeting.type === 'PHONE' ? '📞 Appel téléphonique'
      : '📍 Réunion physique';

    const locationHtml = meeting.meetingLink
      ? `<p style="margin: 8px 0; font-size: 14px; color: #0f172a;"><strong>Lien :</strong> <a href="${meeting.meetingLink}" style="color: #2563eb;">${meeting.meetingLink}</a></p>`
      : meeting.locationDetail
        ? `<p style="margin: 8px 0; font-size: 14px; color: #0f172a;"><strong>Lieu :</strong> ${meeting.locationDetail}</p>`
        : '';

    const text = `Bonjour,\n\nVous êtes invité(e) à un rendez-vous "${meeting.title}" organisé par ${meeting.organizerName}.\n\nDate : ${meeting.date}\nHeure : ${meeting.time}\nDurée : ${meeting.duration} minutes\nType : ${typeLabel}\n\nL'équipe Comptabli`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
          <style>
              body { margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
              .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.02); border: 1px solid #e4e4e7; }
              .header { text-align: center; padding: 40px 20px 0px; }
              .content { padding: 40px; text-align: center; }
              .title { font-size: 20px; font-weight: 800; color: #09090b; margin-bottom: 12px; }
              .text { font-size: 14px; color: #52525b; line-height: 1.5; margin-bottom: 24px; }
              .footer { text-align: center; padding: 30px; font-size: 12px; color: #a1a1aa; background-color: #f4f4f5; }
              .socials { margin-bottom: 15px; }
              .socials span { display: inline-block; margin: 0 5px; width: 28px; height: 28px; border-radius: 50%; background: #e4e4e7; line-height: 28px; color: #3f3f46; font-weight: bold; font-size: 11px; }
          </style>
      </head>
      <body>
          <div style="background-color: #f4f4f5; padding: 40px 20px;">
              <div class="header">
                  <img src="cid:logo" alt="COMPTABLI" height="36" style="display: block; margin: 0 auto; max-width: 100%; border: none; outline: none;" />
              </div>
              <div class="container">
                  <div class="content">
                      <h2 class="title">Invitation à un rendez-vous</h2>
                      <p class="text">
                          Vous avez été invité(e) par <strong>${meeting.organizerName}</strong> à un rendez-vous.
                      </p>
                      
                      <div style="text-align: left; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; max-width: 400px; margin: 0 auto 24px;">
                          <p style="margin: 0 0 6px; font-size: 16px; font-weight: 700; color: #0f172a;">${meeting.title}</p>
                          <p style="margin: 8px 0; font-size: 14px; color: #0f172a;"><strong>📅 Date :</strong> ${meeting.date}</p>
                          <p style="margin: 8px 0; font-size: 14px; color: #0f172a;"><strong>🕐 Heure :</strong> ${meeting.time}</p>
                          <p style="margin: 8px 0; font-size: 14px; color: #0f172a;"><strong>⏱ Durée :</strong> ${meeting.duration} minutes</p>
                          <p style="margin: 8px 0; font-size: 14px; color: #0f172a;"><strong>Type :</strong> ${typeLabel}</p>
                          ${locationHtml}
                      </div>

                      <a href="${loginUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600; padding: 14px 32px; border-radius: 8px; font-size: 15px; margin: 10px 0;">Voir sur Comptabli</a>
                  </div>
              </div>
              <div class="footer">
                  <div class="socials">
                      <span>f</span> <span>in</span> <span>ig</span>
                  </div>
                  Copyright © ${new Date().getFullYear()} COMPTABLI. All rights reserved.
              </div>
          </div>
      </body>
      </html>
    `;

    const sent = await this.sendMail(to, subject, text, html, [{ filename: 'logo.png', path: logoPath, cid: 'logo' }]);
    return { sent };
  }
}
