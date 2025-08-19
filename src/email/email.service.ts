import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import Mail from 'nodemailer/lib/mailer';

@Injectable()
export class EmailService {
  private transporter: Mail;
  private readonly logger = new Logger(EmailService.name);

  constructor(private configService: ConfigService) {
    // Configure based on environment variables
    // For production, use a real email service provider
    // For development, Ethereal is great, or Mailtrap, or even a local SMTP dev server
     // The Ethereal setup is asynchronous, so the transporter might not be ready immediately.
    // We will handle its creation more robustly, potentially on the first sendMail call if needed.
    if (this.configService.get<string>('MAIL_HOST') === 'ethereal') {
      nodemailer.createTestAccount().then(account => {
        this.logger.log(`Ethereal test account created: ${account.user} / ${account.pass}`);
        // this.logger.log(`Preview URL: ${nodemailer.getTestMessageUrl({})} (after sending an email)`);
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false, // true for 465, false for other ports
          auth: {
            user: account.user, // generated ethereal user
            pass: account.pass, // generated ethereal password
          },
        });
      }).catch(err => {
        this.logger.error('Failed to create Ethereal test account', err);
        // Transporter remains undefined, sendMail will attempt to re-initialize or throw
      });
    } else {
      this.transporter = nodemailer.createTransport({
        host: this.configService.get<string>('MAIL_HOST'),
        port: this.configService.get<number>('MAIL_PORT'),
        secure: this.configService.get<string>('MAIL_SECURE') === 'true',
        auth: {
          user: this.configService.get<string>('MAIL_USER'),
          pass: this.configService.get<string>('MAIL_PASSWORD'),
        },
      });
    }
  }

  async sendMail(options: Mail.Options) {
    if (!this.transporter) {
        this.logger.warn('Email transporter not initialized. Attempting to initialize...');
      // Attempt to initialize Ethereal transporter if configured and not yet ready
      if (this.configService.get<string>('MAIL_HOST') === 'ethereal') {
        try {
          const account = await nodemailer.createTestAccount();
          this.logger.log(`Ethereal test account created on demand: ${account.user} / ${account.pass}`);
          this.transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: { user: account.user, pass: account.pass },
          });
        } catch (err) {
          this.logger.error('Failed to create Ethereal test account on demand', err);
          throw new Error('Email service failed to initialize.');
        }
      } else {
        // For other transports, if it's not initialized by now, it's a configuration issue.
        this.logger.error('Email transporter is not configured or failed to initialize for non-Ethereal setup.');
        throw new Error('Email service not configured.');
      }
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"${this.configService.get<string>('MAIL_FROM_NAME', 'PMS Connect App')}" <${this.configService.get<string>('MAIL_FROM_ADDRESS', 'noreply@example.com')}>`,
        ...options,
      });
      this.logger.log('Message sent: %s', info.messageId);
      // Only get preview URL if it's Ethereal and info object is valid
      if (this.configService.get<string>('MAIL_HOST') === 'ethereal' && info) {
        this.logger.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
      }
      return info;
    } catch (error) {
      this.logger.error('Error sending email', error);
      throw error;
    }
  }

  async sendPasswordResetEmail(to: string, token: string, name: string) {
    // In a real app, the reset URL would point to your frontend
    const resetUrl = `${this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173')}/reset-admin-password?token=${token}`;

    const subject = 'Admin Password Reset Request';
    const html = `
      <p>Hello ${name},</p>
      <p>You requested a password reset for your admin account.</p>
      <p>Please click the following link to reset your password:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>This link will expire in ${this.configService.get<string>('ADMIN_PASSWORD_RESET_TOKEN_EXPIRES_IN_TEXT', '15 minutes')}.</p>
      <p>If you did not request this, please ignore this email.</p>
      <p>Thanks,<br/>The PMS Connect Team</p>
    `;
    const text = `
      Hello ${name},
      You requested a password reset for your admin account.
      Please copy and paste the following URL into your browser to reset your password:
      ${resetUrl}
      This link will expire in ${this.configService.get<string>('ADMIN_PASSWORD_RESET_TOKEN_EXPIRES_IN_TEXT', '15 minutes')}.
      If you did not request this, please ignore this email.
      Thanks,
      The PMS Connect Team
    `;

    return this.sendMail({ to, subject, text, html });
  }

   async sendPasswordResetConfirmationEmail(to: string, name: string) {
    const subject = 'Admin Password Changed Successfully';
    const html = `
      <p>Hello ${name},</p>
      <p>Your admin account password has been successfully changed.</p>
      <p>If you did not make this change, please contact support immediately.</p>
      <p>Thanks,<br/>The PMS Connect Team</p>
    `;
    const text = `
      Hello ${name},
      Your admin account password has been successfully changed.
      If you did not make this change, please contact support immediately.
      Thanks,
      The PMS Connect Team
    `;
    return this.sendMail({ to, subject, text, html });
  }
}
