const fs = require('fs/promises');
const path = require('path');
const createTransporter = require('../config/email');
const { getEmailTransportMode } = require('../config/email');

const BRAND_NAME = 'Sigmora';
const DEFAULT_FROM = 'noreply@sigmora.com';
const EMAIL_AUDIT_LOG_PATH = path.join(__dirname, '../../runtime/email-audit.log');

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const toDateText = (value) => new Date(value).toLocaleDateString('en-IN', { dateStyle: 'long' });

const getClientUrl = () => process.env.CLIENT_URL || 'http://localhost:5173';

const getMailIdentity = () => {
  const configuredFrom = (process.env.EMAIL_FROM || DEFAULT_FROM).trim();
  const smtpUser = process.env.EMAIL_USER?.trim();

  if (smtpUser && smtpUser.toLowerCase() !== configuredFrom.toLowerCase()) {
    return {
      from: `"${BRAND_NAME}" <${smtpUser}>`,
      replyTo: configuredFrom,
    };
  }

  return {
    from: `"${BRAND_NAME}" <${configuredFrom}>`,
    replyTo: undefined,
  };
};

const appendEmailAuditEntry = async (entry) => {
  try {
    await fs.mkdir(path.dirname(EMAIL_AUDIT_LOG_PATH), { recursive: true });
    await fs.appendFile(
      EMAIL_AUDIT_LOG_PATH,
      `${JSON.stringify({ timestamp: new Date().toISOString(), ...entry })}\n`,
      'utf8'
    );
  } catch (error) {
    console.error('Email audit log error:', error.message);
  }
};

const sendEmail = async ({ to, subject, html, text }) => {
  if (!to) {
    return null;
  }

  try {
    if (process.env.NODE_ENV === 'test') {
      return {
        accepted: [to],
        rejected: [],
        subject,
        html,
        text: text || '',
        messageId: 'test-message-id',
        deliveryMode: 'test',
        delivered: false,
      };
    }

    const transporter = createTransporter();
    const deliveryMode = transporter.__deliveryMode || getEmailTransportMode();
    const identity = getMailIdentity();

    const mailOptions = {
      from: identity.from,
      to,
      subject,
      html,
      text: text || '',
    };

    if (identity.replyTo) {
      mailOptions.replyTo = identity.replyTo;
    }

    const info = await transporter.sendMail(mailOptions);
    const delivered = deliveryMode === 'smtp';

    await appendEmailAuditEntry({
      to,
      subject,
      status: delivered ? 'smtp-accepted' : 'captured-local',
      deliveryMode,
      messageId: info.messageId || null,
      accepted: info.accepted || [],
      rejected: info.rejected || [],
    });

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Email:${delivered ? 'smtp' : 'local'}] ${subject} -> ${to}`);
    }

    return {
      ...info,
      deliveryMode,
      delivered,
      auditLogPath: EMAIL_AUDIT_LOG_PATH,
    };
  } catch (error) {
    console.error('Email send error:', error.message);
    await appendEmailAuditEntry({
      to,
      subject,
      status: 'failed',
      deliveryMode: getEmailTransportMode(),
      error: error.message,
    });
    // Don't throw — email failures shouldn't break the flow
    return null;
  }
};

const sendVerificationEmail = async (user, token) => {
  const verifyUrl = `${getClientUrl()}/verify-email?token=${token}`;
  return sendEmail({
    to: user.email,
    subject: `Verify Your Email - ${BRAND_NAME}`,
    html: `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #0f766e; margin-bottom: 20px;">Welcome to ${BRAND_NAME}!</h1>
        <p>Hi ${escapeHtml(user.name)},</p>
        <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
        <a href="${verifyUrl}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #0f766e, #14b8a6); color: white; text-decoration: none; border-radius: 10px; margin: 20px 0; font-weight: 600;">Verify Email</a>
        <p style="color: #64748b; font-size: 14px;">If the button doesn't work, copy this link: ${verifyUrl}</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
        <p style="color: #94a3b8; font-size: 12px;">This link expires in 24 hours.</p>
      </div>
    `,
  });
};

const sendVerificationOtpEmail = async (user, otp) => {
  return sendEmail({
    to: user.email,
    subject: `Your ${BRAND_NAME} verification code`,
    text: `Hi ${user?.name || ''}, your ${BRAND_NAME} email verification OTP is ${otp}. It expires in 10 minutes.`,
    html: `
      <div style="font-family: 'Inter', sans-serif; max-width: 620px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #0f766e; margin-bottom: 18px;">Verify your email</h1>
        <p>Hi ${escapeHtml(user.name || 'there')},</p>
        <p>Use the one-time password below to verify your ${BRAND_NAME} account.</p>
        <div style="margin: 24px 0; padding: 20px; border-radius: 18px; background: #f0fdfa; border: 1px solid #99f6e4; text-align: center;">
          <div style="font-size: 2rem; font-weight: 800; letter-spacing: 0.35em; color: #0f766e;">${escapeHtml(otp)}</div>
        </div>
        <p style="color: #64748b; font-size: 14px;">This OTP expires in 10 minutes. If you did not request this, you can ignore this email.</p>
      </div>
    `,
  });
};

const sendPasswordResetEmail = async (user, token) => {
  const resetUrl = `${getClientUrl()}/reset-password/${token}`;
  return sendEmail({
    to: user.email,
    subject: `Reset Your Password - ${BRAND_NAME}`,
    html: `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #0f766e; margin-bottom: 20px;">Password Reset</h1>
        <p>Hi ${escapeHtml(user.name)},</p>
        <p>You requested a password reset. Click the button below to set a new password:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #0f766e, #14b8a6); color: white; text-decoration: none; border-radius: 10px; margin: 20px 0; font-weight: 600;">Reset Password</a>
        <p style="color: #64748b; font-size: 14px;">If you didn't request this, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
        <p style="color: #94a3b8; font-size: 12px;">This link expires in 1 hour.</p>
      </div>
    `,
  });
};

const sendPasswordResetOtpEmail = async (user, otp) => {
  return sendEmail({
    to: user.email,
    subject: `Your ${BRAND_NAME} password reset code`,
    text: `Hi ${user?.name || ''}, your ${BRAND_NAME} password reset OTP is ${otp}. It expires in 10 minutes.`,
    html: `
      <div style="font-family: 'Inter', sans-serif; max-width: 620px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #0f766e; margin-bottom: 18px;">Reset your password</h1>
        <p>Hi ${escapeHtml(user.name || 'there')},</p>
        <p>Use this OTP to continue resetting your password.</p>
        <div style="margin: 24px 0; padding: 20px; border-radius: 18px; background: #eff6ff; border: 1px solid #bfdbfe; text-align: center;">
          <div style="font-size: 2rem; font-weight: 800; letter-spacing: 0.35em; color: #0f172a;">${escapeHtml(otp)}</div>
        </div>
        <p style="color: #64748b; font-size: 14px;">This OTP expires in 10 minutes. If you did not request a reset, you can safely ignore this email.</p>
      </div>
    `,
  });
};

const sendPasswordChangedEmail = async (user) => {
  return sendEmail({
    to: user.email,
    subject: `Your ${BRAND_NAME} password was changed`,
    html: `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #0f766e; margin-bottom: 20px;">Password updated</h1>
        <p>Hi ${escapeHtml(user.name)},</p>
        <p>Your ${BRAND_NAME} account password was changed successfully.</p>
        <p style="color: #64748b;">If you did not make this change, please reset your password immediately and contact support.</p>
      </div>
    `,
  });
};

const sendBookingHoldEmail = async (user, booking, hotel, room) => {
  const confirmationUrl = `${getClientUrl()}/booking/confirmation/${booking._id}`;

  return sendEmail({
    to: user.email,
    subject: `Complete your booking - ${hotel.title}`,
    html: `
      <div style="font-family: 'Inter', sans-serif; max-width: 620px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #d97706; margin-bottom: 18px;">Your room is temporarily held</h1>
        <p>Hi ${escapeHtml(user.name)},</p>
        <p>We created your booking for <strong>${escapeHtml(hotel.title)}</strong>. Please complete payment before the hold expires.</p>
        <div style="background: #fff7ed; border-radius: 14px; padding: 18px 20px; margin: 20px 0; border: 1px solid #fed7aa;">
          <p style="margin: 0 0 8px;"><strong>Room:</strong> ${escapeHtml(room?.title || 'Selected room')}</p>
          <p style="margin: 0 0 8px;"><strong>Check-in:</strong> ${toDateText(booking.checkIn)}</p>
          <p style="margin: 0 0 8px;"><strong>Check-out:</strong> ${toDateText(booking.checkOut)}</p>
          <p style="margin: 0;"><strong>Estimated total:</strong> ₹${Number(booking.pricing?.totalPrice || 0).toLocaleString('en-IN')}</p>
        </div>
        <a href="${confirmationUrl}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #0f766e, #14b8a6); color: white; text-decoration: none; border-radius: 10px; font-weight: 600;">Open Booking</a>
      </div>
    `,
  });
};

const sendBookingConfirmationEmail = async (user, booking, hotel) => {
  return sendEmail({
    to: user.email,
    subject: `Booking Confirmed - ${hotel.title}`,
    html: `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #10b981; margin-bottom: 20px;">Booking confirmed</h1>
        <p>Hi ${escapeHtml(user.name)},</p>
        <p>Your stay is confirmed. Here are the details:</p>
        <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <p><strong>Hotel:</strong> ${escapeHtml(hotel.title)}</p>
          <p><strong>Location:</strong> ${escapeHtml(hotel.address.city)}, ${escapeHtml(hotel.address.state)}</p>
          <p><strong>Check-in:</strong> ${toDateText(booking.checkIn)}</p>
          <p><strong>Check-out:</strong> ${toDateText(booking.checkOut)}</p>
          <p><strong>Guests:</strong> ${booking.guests.adults} Adults${booking.guests.children ? `, ${booking.guests.children} Children` : ''}</p>
          <p><strong>Booking ID:</strong> ${escapeHtml(String(booking._id).slice(-8).toUpperCase())}</p>
          <p style="font-size: 18px; margin-top: 16px;"><strong>Total: ₹${Number(booking.pricing.totalPrice || 0).toLocaleString('en-IN')}</strong></p>
        </div>
        <a href="${getClientUrl()}/dashboard" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #0f766e, #14b8a6); color: white; text-decoration: none; border-radius: 10px; font-weight: 600;">View Booking</a>
      </div>
    `,
  });
};

const sendBookingCancellationEmail = async (user, booking, hotel) => {
  return sendEmail({
    to: user.email,
    subject: `Booking Cancelled - ${hotel.title}`,
    html: `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #ef4444; margin-bottom: 20px;">Booking cancelled</h1>
        <p>Hi ${escapeHtml(user.name)},</p>
        <p>Your booking at <strong>${escapeHtml(hotel.title)}</strong> has been cancelled.</p>
        ${booking.refundAmount > 0 ? `<p>A refund of <strong>₹${Number(booking.refundAmount).toLocaleString('en-IN')}</strong> has been initiated.</p>` : ''}
        ${booking.cancellationReason ? `<p><strong>Reason:</strong> ${escapeHtml(booking.cancellationReason)}</p>` : ''}
        <a href="${getClientUrl()}/hotels" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #0f766e, #14b8a6); color: white; text-decoration: none; border-radius: 10px; margin: 20px 0; font-weight: 600;">Browse Hotels</a>
      </div>
    `,
  });
};

const sendBookingPaymentFailedEmail = async (user, booking, hotel) => {
  return sendEmail({
    to: user.email,
    subject: `Payment failed - ${hotel.title}`,
    html: `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #ef4444; margin-bottom: 20px;">Payment was not completed</h1>
        <p>Hi ${escapeHtml(user.name)},</p>
        <p>Your payment for <strong>${escapeHtml(hotel.title)}</strong> did not complete successfully, so the room hold was released.</p>
        <p>You can create a fresh booking again if the room is still available.</p>
        <a href="${getClientUrl()}/hotels/${hotel.slug || hotel._id}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #0f766e, #14b8a6); color: white; text-decoration: none; border-radius: 10px; margin: 20px 0; font-weight: 600;">View Hotel</a>
      </div>
    `,
  });
};

const sendRefundIssuedEmail = async (user, booking, hotel, amount) => {
  return sendEmail({
    to: user.email,
    subject: `Refund initiated - ${hotel.title}`,
    html: `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #0f766e; margin-bottom: 20px;">Refund initiated</h1>
        <p>Hi ${escapeHtml(user.name)},</p>
        <p>A refund has been initiated for your booking at <strong>${escapeHtml(hotel.title)}</strong>.</p>
        <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <p><strong>Booking ID:</strong> ${escapeHtml(String(booking._id).slice(-8).toUpperCase())}</p>
          <p><strong>Refund amount:</strong> ₹${Number(amount || 0).toLocaleString('en-IN')}</p>
          <p><strong>Payment reference:</strong> ${escapeHtml(booking.payment?.refundId || booking.payment?.transactionId || 'Will be shared by support if needed')}</p>
        </div>
        <a href="${getClientUrl()}/dashboard" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #0f766e, #14b8a6); color: white; text-decoration: none; border-radius: 10px; font-weight: 600;">View Booking</a>
      </div>
    `,
  });
};

const sendOwnerBookingAlertEmail = async ({
  owner,
  guest,
  booking,
  hotel,
  room,
  action = 'confirmed',
}) => {
  if (!owner?.email) {
    return null;
  }

  const isCancelled = action === 'cancelled';
  const subject = isCancelled
    ? `Booking cancelled at ${hotel.title}`
    : `New confirmed booking at ${hotel.title}`;

  return sendEmail({
    to: owner.email,
    subject,
    html: `
      <div style="font-family: 'Inter', sans-serif; max-width: 620px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: ${isCancelled ? '#ef4444' : '#0f766e'}; margin-bottom: 18px;">${isCancelled ? 'Booking cancelled' : 'New confirmed booking'}</h1>
        <p>Hi ${escapeHtml(owner.name || 'Partner')},</p>
        <p>${isCancelled ? 'A booking has been cancelled.' : 'A booking has just been confirmed.'}</p>
        <div style="background: #f8fafc; border-radius: 14px; padding: 18px 20px; margin: 20px 0; border: 1px solid #dbeafe;">
          <p style="margin: 0 0 8px;"><strong>Hotel:</strong> ${escapeHtml(hotel.title)}</p>
          <p style="margin: 0 0 8px;"><strong>Room:</strong> ${escapeHtml(room?.title || 'Selected room')}</p>
          <p style="margin: 0 0 8px;"><strong>Guest:</strong> ${escapeHtml(guest?.name || 'Guest')}${guest?.email ? ` (${escapeHtml(guest.email)})` : ''}</p>
          <p style="margin: 0 0 8px;"><strong>Stay:</strong> ${toDateText(booking.checkIn)} to ${toDateText(booking.checkOut)}</p>
          <p style="margin: 0;"><strong>Total:</strong> ₹${Number(booking.pricing?.totalPrice || 0).toLocaleString('en-IN')}</p>
        </div>
        <a href="${getClientUrl()}/${isCancelled ? 'admin/bookings' : 'admin'}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #0f766e, #14b8a6); color: white; text-decoration: none; border-radius: 10px; font-weight: 600;">Open Admin Dashboard</a>
      </div>
    `,
  });
};

const sendSupportQueryAlertEmail = async ({
  owner,
  guest,
  hotel,
  latestMessage,
  conversationId,
  subject,
}) => {
  const supportUrl = `${getClientUrl()}/support?conversation=${conversationId}`;
  const guestName = escapeHtml(guest?.name || 'A guest');
  const ownerName = escapeHtml(owner?.name || 'Partner');
  const hotelTitle = escapeHtml(hotel?.title || 'your hotel');
  const safeSubject = escapeHtml(subject || `Questions about ${hotelTitle}`);
  const safeMessage = escapeHtml(latestMessage?.text || '');

  return sendEmail({
    to: owner.email,
    subject: `New guest query for ${hotelTitle} - ${BRAND_NAME}`,
    text: `${guestName} sent a new support message for ${hotelTitle}: ${latestMessage?.text || ''}. Open ${supportUrl}`,
    html: `
      <div style="font-family: 'Inter', sans-serif; max-width: 620px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #0f766e; margin-bottom: 18px;">New guest query</h1>
        <p>Hi ${ownerName},</p>
        <p>A guest has sent a new message about <strong>${hotelTitle}</strong>.</p>
        <div style="background: #f8fafc; border-radius: 14px; padding: 18px 20px; margin: 20px 0; border: 1px solid #dbeafe;">
          <p style="margin: 0 0 8px;"><strong>Guest:</strong> ${guestName}${guest?.email ? ` (${escapeHtml(guest.email)})` : ''}</p>
          <p style="margin: 0 0 8px;"><strong>Subject:</strong> ${safeSubject}</p>
          <p style="margin: 0;"><strong>Latest message:</strong><br />${safeMessage}</p>
        </div>
        <a href="${supportUrl}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #0f766e, #14b8a6); color: white; text-decoration: none; border-radius: 10px; font-weight: 600;">Open Support Inbox</a>
      </div>
    `,
  });
};

const sendSupportReplyEmail = async ({
  recipient,
  sender,
  hotel,
  latestMessage,
  conversationId,
  subject,
}) => {
  if (!recipient?.email) {
    return null;
  }

  const supportUrl = `${getClientUrl()}/support?conversation=${conversationId}`;
  const safeSubject = escapeHtml(subject || `Questions about ${hotel?.title || 'your stay'}`);
  const safeMessage = escapeHtml(latestMessage?.text || '');
  const senderName = escapeHtml(sender?.name || 'Support team');
  const hotelTitle = escapeHtml(hotel?.title || 'your stay');

  return sendEmail({
    to: recipient.email,
    subject: `New reply about ${hotelTitle} - ${BRAND_NAME}`,
    html: `
      <div style="font-family: 'Inter', sans-serif; max-width: 620px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #0f766e; margin-bottom: 18px;">You have a new support reply</h1>
        <p>Hi ${escapeHtml(recipient.name || 'there')},</p>
        <p>${senderName} sent a new reply regarding <strong>${hotelTitle}</strong>.</p>
        <div style="background: #f8fafc; border-radius: 14px; padding: 18px 20px; margin: 20px 0; border: 1px solid #dbeafe;">
          <p style="margin: 0 0 8px;"><strong>Subject:</strong> ${safeSubject}</p>
          <p style="margin: 0;"><strong>Latest message:</strong><br />${safeMessage}</p>
        </div>
        <a href="${supportUrl}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #0f766e, #14b8a6); color: white; text-decoration: none; border-radius: 10px; font-weight: 600;">Open Conversation</a>
      </div>
    `,
  });
};

const sendAdminCreatedCredentialsEmail = async ({
  user,
  plainPassword,
  createdBy,
}) => {
  const loginUrl = `${getClientUrl()}/login`;
  const userName = escapeHtml(user?.name || 'there');
  const creatorName = escapeHtml(createdBy?.name || 'The Sigmora admin team');
  const roleLabel = escapeHtml(user?.role === 'admin' ? 'Admin' : 'User');

  return sendEmail({
    to: user.email,
    subject: `Your ${BRAND_NAME} login credentials`,
    text: `Hi ${user?.name || ''}, your ${BRAND_NAME} ${roleLabel} account is ready. Email: ${user.email} Password: ${plainPassword} Login: ${loginUrl}`,
    html: `
      <div style="font-family: 'Inter', sans-serif; max-width: 620px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #0f766e; margin-bottom: 18px;">Your account is ready</h1>
        <p>Hi ${userName},</p>
        <p>${creatorName} created a <strong>${roleLabel}</strong> account for you on ${BRAND_NAME}. These credentials are active now and you can log in right away.</p>
        <div style="background: #f8fafc; border-radius: 14px; padding: 18px 20px; margin: 20px 0; border: 1px solid #d1fae5;">
          <p style="margin: 0 0 8px;"><strong>Email:</strong> ${escapeHtml(user.email)}</p>
          <p style="margin: 0 0 8px;"><strong>Password:</strong> ${escapeHtml(plainPassword)}</p>
          <p style="margin: 0;"><strong>Role:</strong> ${roleLabel}</p>
        </div>
        <a href="${loginUrl}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #0f766e, #14b8a6); color: white; text-decoration: none; border-radius: 10px; font-weight: 600;">Log In To ${BRAND_NAME}</a>
        <p style="margin-top: 18px; color: #475569;">For security, please change your password after your first login.</p>
      </div>
    `,
  });
};

const sendUserStatusChangedEmail = async ({ user, isActive, changedBy }) => {
  if (!user?.email) {
    return null;
  }

  const changedByName = escapeHtml(changedBy?.name || 'The Sigmora admin team');
  const title = isActive ? 'Your account has been reactivated' : 'Your account has been deactivated';
  const bodyCopy = isActive
    ? 'Your access has been restored. You can sign in again and continue using the platform.'
    : 'Your access has been disabled by the admin team. If you believe this is a mistake, please contact support.';

  return sendEmail({
    to: user.email,
    subject: `${title} - ${BRAND_NAME}`,
    text: `Hi ${user?.name || ''}, ${bodyCopy}`,
    html: `
      <div style="font-family: 'Inter', sans-serif; max-width: 620px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: ${isActive ? '#0f766e' : '#ef4444'}; margin-bottom: 18px;">${title}</h1>
        <p>Hi ${escapeHtml(user.name || 'there')},</p>
        <p>${bodyCopy}</p>
        <div style="background: #f8fafc; border-radius: 14px; padding: 18px 20px; margin: 20px 0; border: 1px solid #dbeafe;">
          <p style="margin: 0 0 8px;"><strong>Account:</strong> ${escapeHtml(user.email)}</p>
          <p style="margin: 0;"><strong>Updated by:</strong> ${changedByName}</p>
        </div>
        <a href="${getClientUrl()}/support" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #0f766e, #14b8a6); color: white; text-decoration: none; border-radius: 10px; font-weight: 600;">Contact Support</a>
      </div>
    `,
  });
};

const sendHotelDeletedOwnerEmail = async ({ owner, hotel, deletedBy }) => {
  if (!owner?.email) {
    return null;
  }

  return sendEmail({
    to: owner.email,
    subject: `Hotel removed from listings - ${hotel.title}`,
    text: `${hotel.title} has been removed from active listings by ${deletedBy?.name || 'the admin team'}.`,
    html: `
      <div style="font-family: 'Inter', sans-serif; max-width: 620px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #ef4444; margin-bottom: 18px;">Hotel removed from active listings</h1>
        <p>Hi ${escapeHtml(owner.name || 'Partner')},</p>
        <p><strong>${escapeHtml(hotel.title)}</strong> has been removed from active listings by ${escapeHtml(deletedBy?.name || 'the admin team')}.</p>
        <div style="background: #fff7ed; border-radius: 14px; padding: 18px 20px; margin: 20px 0; border: 1px solid #fed7aa;">
          <p style="margin: 0 0 8px;"><strong>Hotel:</strong> ${escapeHtml(hotel.title)}</p>
          <p style="margin: 0;"><strong>Location:</strong> ${escapeHtml(hotel.address?.city || '')}${hotel.address?.state ? `, ${escapeHtml(hotel.address.state)}` : ''}</p>
        </div>
        <a href="${getClientUrl()}/admin/hotels" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #0f766e, #14b8a6); color: white; text-decoration: none; border-radius: 10px; font-weight: 600;">Open Hotel Management</a>
      </div>
    `,
  });
};

const sendHotelDeletedGuestEmail = async ({ guest, hotel, booking }) => {
  if (!guest?.email) {
    return null;
  }

  return sendEmail({
    to: guest.email,
    subject: `Hotel unavailable - ${hotel.title}`,
    text: `${hotel.title} has been removed from active listings. Please review your booking and contact support if you need help.`,
    html: `
      <div style="font-family: 'Inter', sans-serif; max-width: 620px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #ef4444; margin-bottom: 18px;">Hotel no longer available</h1>
        <p>Hi ${escapeHtml(guest.name || 'there')},</p>
        <p>The hotel <strong>${escapeHtml(hotel.title)}</strong> has been removed from active listings.</p>
        <div style="background: #f8fafc; border-radius: 14px; padding: 18px 20px; margin: 20px 0; border: 1px solid #dbeafe;">
          <p style="margin: 0 0 8px;"><strong>Hotel:</strong> ${escapeHtml(hotel.title)}</p>
          <p style="margin: 0 0 8px;"><strong>Booking ID:</strong> ${escapeHtml(String(booking?._id || '').slice(-8).toUpperCase())}</p>
          <p style="margin: 0;"><strong>Stay dates:</strong> ${booking?.checkIn ? toDateText(booking.checkIn) : 'TBD'}${booking?.checkOut ? ` to ${toDateText(booking.checkOut)}` : ''}</p>
        </div>
        <p style="color: #475569;">Please contact the support team if you need help with next steps.</p>
        <a href="${getClientUrl()}/support" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #0f766e, #14b8a6); color: white; text-decoration: none; border-radius: 10px; font-weight: 600;">Contact Support</a>
      </div>
    `,
  });
};

const sendNewsletterSubscriptionEmail = async ({ email, name = 'traveler' }) => {
  return sendEmail({
    to: email,
    subject: `You’re subscribed to ${BRAND_NAME} updates`,
    text: `Hi ${name}, you are now subscribed to ${BRAND_NAME} newsletters for new offers, travel ideas, and platform updates.`,
    html: `
      <div style="font-family: 'Inter', sans-serif; max-width: 620px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #0f766e; margin-bottom: 18px;">Subscription confirmed</h1>
        <p>Hi ${escapeHtml(name)},</p>
        <p>Thanks for subscribing to ${BRAND_NAME}. We’ll share carefully selected offers, destination ideas, and product updates.</p>
        <div style="margin: 22px 0; padding: 18px 20px; border-radius: 18px; background: #f8fafc; border: 1px solid #e2e8f0;">
          <p style="margin: 0;"><strong>Subscribed email:</strong> ${escapeHtml(email)}</p>
        </div>
        <a href="${getClientUrl()}/hotels" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #0f766e, #14b8a6); color: white; text-decoration: none; border-radius: 10px; font-weight: 600;">Explore stays</a>
      </div>
    `,
  });
};

module.exports = {
  EMAIL_AUDIT_LOG_PATH,
  sendEmail,
  sendVerificationEmail,
  sendVerificationOtpEmail,
  sendPasswordResetEmail,
  sendPasswordResetOtpEmail,
  sendPasswordChangedEmail,
  sendBookingHoldEmail,
  sendBookingConfirmationEmail,
  sendBookingCancellationEmail,
  sendBookingPaymentFailedEmail,
  sendRefundIssuedEmail,
  sendOwnerBookingAlertEmail,
  sendSupportQueryAlertEmail,
  sendSupportReplyEmail,
  sendAdminCreatedCredentialsEmail,
  sendNewsletterSubscriptionEmail,
  sendUserStatusChangedEmail,
  sendHotelDeletedOwnerEmail,
  sendHotelDeletedGuestEmail,
};
