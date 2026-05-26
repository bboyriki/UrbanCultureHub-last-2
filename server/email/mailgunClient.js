import FormData from 'form-data';
import Mailgun from 'mailgun.js';

const mailgun = new Mailgun(FormData);

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || 'dancehealthy.net';
const MAILGUN_FROM = process.env.MAILGUN_FROM_EMAIL || 'Dance Healthy <riki@dancehealthy.net>';

// Initialize Mailgun client
let mg = null;

try {
  if (!MAILGUN_API_KEY) {
    console.warn('⚠️  MAILGUN_API_KEY not set - email functionality disabled');
  } else {
    mg = mailgun.client({ username: 'api', key: MAILGUN_API_KEY });
    console.log('✅ Mailgun client initialized');
  }
} catch (error) {
  console.error('❌ Failed to initialize Mailgun:', error);
}

/**
 * Send ticket purchase confirmation email
 * @param {string} toEmail - Recipient email
 * @param {Object} ticketData - Ticket purchase data
 * @param {number} ticketData.ticketId - Ticket ID
 * @param {string} ticketData.eventName - Event name
 * @param {string} ticketData.eventDate - Event date
 * @param {string} ticketData.ticketCode - Unique ticket code
 * @param {string} ticketData.buyerName - Buyer name
 * @param {string} ticketData.qrCodeUrl - QR code image URL
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendTicketEmail(toEmail, ticketData) {
  if (!mg) {
    console.warn('[Mailgun] Email service not configured, skipping ticket email');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    console.log(`[Mailgun] Sending ticket email to ${toEmail}`);

    const {
      ticketId,
      eventName,
      eventDate,
      ticketCode,
      buyerName,
      qrCodeUrl,
      quantity = 1,
      totalPrice = 0
    } = ticketData;

    // Format date if provided
    let formattedDate = eventDate;
    if (eventDate && typeof eventDate === 'string') {
      try {
        const date = new Date(eventDate);
        formattedDate = date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch (err) {
        console.warn('[Mailgun] Could not format date:', err);
      }
    }

    // Create email HTML
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .ticket-details { background: white; border: 2px solid #667eea; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        .detail-row:last-child { border-bottom: none; }
        .label { font-weight: bold; color: #667eea; }
        .qr-code { text-align: center; margin: 20px 0; }
        .qr-code img { max-width: 200px; height: auto; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; border-radius: 4px; text-decoration: none; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Ticket Confirmation</h1>
            <p>Your event ticket has been purchased successfully!</p>
        </div>
        <div class="content">
            <p>Hello ${buyerName || 'Guest'},</p>
            
            <p>Thank you for purchasing a ticket to our event. Your booking is confirmed.</p>
            
            <div class="ticket-details">
                <div class="detail-row">
                    <span class="label">Event:</span>
                    <span>${eventName}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Date & Time:</span>
                    <span>${formattedDate}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Ticket ID:</span>
                    <span>${ticketId}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Ticket Code:</span>
                    <span style="font-weight: bold; color: #667eea; font-size: 18px;">${ticketCode}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Quantity:</span>
                    <span>${quantity}</span>
                </div>
                ${totalPrice > 0 ? `
                <div class="detail-row">
                    <span class="label">Total Price:</span>
                    <span>€${totalPrice.toFixed(2)}</span>
                </div>
                ` : ''}
            </div>
            
            ${qrCodeUrl ? `
            <div class="qr-code">
                <p><strong>QR Code for Entry:</strong></p>
                <img src="${qrCodeUrl}" alt="Ticket QR Code" />
                <p><small>Show this QR code at the venue for entry</small></p>
            </div>
            ` : ''}
            
            <p>
                <strong>Important:</strong> Please keep this email and your ticket code safe. 
                You'll need to present your ticket code or QR code at the event venue.
            </p>
            
            <p>
                If you have any questions about your ticket, please don't hesitate to contact us.
            </p>
            
            <p>
                Best regards,<br>
                <strong>Dance Healthy Team</strong>
            </p>
            
            <div class="footer">
                <p>This is an automated message. Please do not reply to this email.</p>
                <p>© 2025 Dance Healthy. All rights reserved.</p>
            </div>
        </div>
    </div>
</body>
</html>
    `;

    // Send email via Mailgun
    const response = await mg.messages.create(MAILGUN_DOMAIN, {
      from: MAILGUN_FROM,
      to: toEmail,
      subject: `Ticket Confirmation for ${eventName}`,
      html: htmlContent,
      'o:tracking': true,
      'o:tracking-clicks': true,
    });

    console.log(`[Mailgun] Ticket email sent successfully to ${toEmail}`);
    console.log(`[Mailgun] Message ID: ${response.id}`);

    return { success: true, messageId: response.id };
  } catch (error) {
    console.error('[Mailgun] Error sending ticket email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send a generic email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email HTML content
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendEmail({ to, subject, html }) {
  if (!mg) {
    console.warn('[Mailgun] Email service not configured');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    console.log(`[Mailgun] Sending email to ${to}`);

    const response = await mg.messages.create(MAILGUN_DOMAIN, {
      from: MAILGUN_FROM,
      to,
      subject,
      html,
    });

    console.log(`[Mailgun] Email sent successfully to ${to}`);
    return { success: true, messageId: response.id };
  } catch (error) {
    console.error('[Mailgun] Error sending email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if email service is available
 * @returns {boolean}
 */
export function isEmailServiceAvailable() {
  return mg !== null && MAILGUN_API_KEY !== undefined;
}
