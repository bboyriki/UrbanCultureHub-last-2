import formData from 'form-data';
import Mailgun from 'mailgun.js';
import { User, Service, ServiceBooking, Event, Ticket, Order, OrderItem, Product, ContactSubmission } from '@shared/schema';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Set up global email configuration constants
// Using riki@dancehealthy.net as the verified sender for ticket emails
const VERIFIED_SENDER_EMAIL = 'riki@dancehealthy.net';
const VERIFIED_SENDER_DISPLAY = 'Riki | Urban Culture Hub <riki@dancehealthy.net>';
const ADMIN_EMAIL = 'oudaialmouti@gmail.com';

// Initialize Mailgun client
const mailgun = new Mailgun(formData);
let mg: ReturnType<typeof mailgun.client> | null = null;
let isMailgunConfigured = false;

// Log email configuration
console.log("====== EMAIL SYSTEM INITIALIZATION ======");
console.log(`Mailgun Domain Present: ${!!process.env.MAILGUN_DOMAIN}`);
console.log(`Mailgun Domain: ${process.env.MAILGUN_DOMAIN || 'N/A'}`);

// Keep track of email status
export const emailSystem = {
  isConfigured: false,
  isEnabled: true, // Default to enabled (can be disabled if needed)
  hasCredits: true, // Assume we have credits until we discover otherwise
  lastError: null as Error | null,
  errorMessage: '',
  maxCreditsExceeded: false,
  totalAttempts: 0,
  successfulAttempts: 0,
  failedAttempts: 0,
  lastSuccessfulSendTime: null as Date | null,
  isApiKeyWorking: true, // Flag to indicate if the current API key is valid
  lastApiKeyCheck: null as Date | null, // Last time the API key was validated
  debug: true, // Enable detailed debug logging by default for troubleshooting
  debugLogs: [] as string[] // Store debug logs
};

/**
 * Check if Mailgun API key is valid by making a simple API call
 * This function should be called periodically to verify API key status
 */
export async function checkMailgunApiKey(): Promise<boolean> {
  if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
    console.warn("Mailgun API key or domain not found in environment variables");
    emailSystem.isApiKeyWorking = false;
    emailSystem.errorMessage = "Mailgun API key or domain is not configured";
    return false;
  }

  try {
    if (!mg) {
      console.warn("Mailgun client not initialized");
      return false;
    }
    
    // Make a simple API call to validate the key - get domain info
    await mg.domains.get(process.env.MAILGUN_DOMAIN);
    
    console.log("Mailgun API key validation successful");
    emailSystem.isApiKeyWorking = true;
    emailSystem.lastApiKeyCheck = new Date();
    return true;
  } catch (error: any) {
    console.error("Mailgun API key validation failed:", error?.message || "Unknown error");
    emailSystem.isApiKeyWorking = false;
    emailSystem.lastApiKeyCheck = new Date();
    emailSystem.errorMessage = error?.message || "Mailgun API key validation failed";
    return false;
  }
}

/**
 * Send a terms of service acceptance notification to the admin
 */
export async function sendTermsAcceptanceNotification(
  user: User | null,
  userId: number,
  ipAddress: string,
  userAgent: string
): Promise<boolean> {
  console.log(`Sending Terms of Service acceptance notification for user ${userId}`);
  if (!isMailgunConfigured) {
    console.warn("Mailgun is not configured. Terms of Service acceptance notification will not be sent.");
    return false;
  }
  
  // Check if Mailgun free tier credits are exceeded
  if (emailSystem.maxCreditsExceeded) {
    console.warn("Mailgun maximum credits exceeded. Terms of Service acceptance notification will not be sent.");
    return false;
  }
  
  try {
    // Format the accepted date with Dutch format
    const acceptedDate = new Date();
    const formattedDate = acceptedDate.toLocaleString('nl-NL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Europe/Amsterdam'
    });

    // Create HTML email content
    const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e4; border-radius: 5px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #333; margin-bottom: 5px;">Terms of Service Acceptance</h1>
        <p style="color: #666;">A user has accepted the Terms of Service agreement</p>
      </div>
      
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
        <h2 style="color: #333; font-size: 18px; margin-top: 0;">User Information</h2>
        <p><strong>User:</strong> ${user ? `${user.displayName} (${user.email})` : `User ID: ${userId}`}</p>
        <p><strong>Date/Time:</strong> ${formattedDate}</p>
        <p><strong>IP Address:</strong> ${ipAddress || 'Unknown'}</p>
        <p><strong>User Agent:</strong> ${userAgent || 'Unknown'}</p>
      </div>
      
      <div style="margin-bottom: 20px;">
        <h2 style="color: #333; font-size: 18px;">Legal Compliance Information</h2>
        <p>This user acceptance has been recorded in the database and can be referenced for legal compliance purposes.</p>
      </div>
      
      <div style="text-align: center; font-size: 12px; color: #666; margin-top: 30px; border-top: 1px solid #e4e4e4; padding-top: 20px;">
        <p>This is an automated notification sent by the Urban Culture platform.</p>
        <p>© ${new Date().getFullYear()} Urban Culture. All rights reserved.</p>
      </div>
    </div>
    `;
    
    // Create plain text version
    const textContent = `
Terms of Service Acceptance

A user has accepted the Terms of Service agreement

User Information:
- User: ${user ? `${user.displayName} (${user.email})` : `User ID: ${userId}`}
- Date/Time: ${formattedDate}
- IP Address: ${ipAddress || 'Unknown'}
- User Agent: ${userAgent || 'Unknown'}

Legal Compliance Information:
This user acceptance has been recorded in the database and can be referenced for legal compliance purposes.

This is an automated notification sent by the Urban Culture platform.
© ${new Date().getFullYear()} Urban Culture. All rights reserved.
    `;
    
    // Prepare email message to admin
    const adminMsg = {
      to: ADMIN_EMAIL,
      from: VERIFIED_SENDER_EMAIL,
      subject: 'Terms of Service Acceptance Notification',
      text: textContent,
      html: emailHtml
    };
    
    // Send notification to the admin
    await sendEmail(adminMsg);
    console.log(`Sent Terms of Service acceptance notification email to ${ADMIN_EMAIL} for user #${userId}`);
    emailSystem.successfulAttempts++;
    emailSystem.totalAttempts++;
    
    return true;
  } catch (error) {
    console.error('Error sending Terms of Service acceptance notification email:', error);
    emailSystem.failedAttempts++;
    emailSystem.totalAttempts++;
    emailSystem.lastError = error as Error;
    return false;
  }
}

/**
 * Send a privacy policy acceptance notification to the admin
 */
export async function sendPrivacyPolicyAcceptanceNotification(
  user: User,
  ipAddress: string,
  userAgent: string
): Promise<boolean> {
  console.log(`Sending privacy policy acceptance notification for user ${user.id}`);
  if (!isMailgunConfigured) {
    console.warn("Mailgun is not configured. Privacy policy acceptance notification will not be sent.");
    return false;
  }
  
  // Check if Mailgun free tier credits are exceeded
  if (emailSystem.maxCreditsExceeded) {
    console.warn("Mailgun maximum credits exceeded. Privacy policy acceptance notification will not be sent.");
    return false;
  }
  
  if (!user?.email || !user?.id) {
    console.warn("Missing required user information for privacy policy acceptance notification.");
    return false;
  }
  
  try {
    // Format the accepted date with Dutch format
    const acceptedDate = new Date();
    const formattedDate = acceptedDate.toLocaleString('nl-NL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Europe/Amsterdam'
    });

    // Format the IP address information
    const ipInfo = ipAddress || 'Unknown';

    // Email content with HTML formatting
    const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #333;">Privacy Policy Acceptance Notification</h1>
      </div>
      
      <div style="background-color: #f8f8f8; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
        <h2 style="color: #333; margin-top: 0;">User Information</h2>
        <p><strong>User ID:</strong> ${user.id}</p>
        <p><strong>Email:</strong> ${user.email}</p>
        <p><strong>Name:</strong> ${user.displayName || 'Not provided'}</p>
        <p><strong>Role:</strong> ${user.role || 'Not specified'}</p>
      </div>
      
      <div style="background-color: #f8f8f8; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
        <h2 style="color: #333; margin-top: 0;">Acceptance Details</h2>
        <p><strong>Date & Time:</strong> ${formattedDate}</p>
        <p><strong>IP Address:</strong> ${ipInfo}</p>
        <p><strong>User Agent:</strong> ${userAgent || 'Not available'}</p>
      </div>
      
      <div style="background-color: #f0f7ff; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
        <h2 style="color: #0056b3; margin-top: 0;">Legal Information</h2>
        <p>This email serves as an official record that the user has accepted the privacy policy of Urban Culture.</p>
        <p>This acceptance is stored in the database and can be used for legal compliance purposes.</p>
      </div>
      
      <div style="text-align: center; font-size: 12px; color: #666; margin-top: 30px;">
        <p>This is an automated notification sent by the Urban Culture platform.</p>
      </div>
    </div>
    `;

    // Email to admin
    const adminMsg = {
      to: ADMIN_EMAIL,
      from: VERIFIED_SENDER_EMAIL,
      subject: `Urban Culture: Privacy Policy Acceptance - User #${user.id}`,
      text: emailHtml.replace(/<[^>]*>?/gm, ''),
      html: emailHtml,
    };

    try {
      // Send notification to the admin
      await sendEmail(adminMsg);
      console.log(`Sent privacy policy acceptance notification email to ${ADMIN_EMAIL} for user #${user.id}`);
      emailSystem.successfulAttempts++;
      emailSystem.totalAttempts++;
      
      return true;
    } catch (sendError: any) {
      console.error('Error sending privacy policy acceptance notification email:', sendError);
      emailSystem.failedAttempts++;
      emailSystem.totalAttempts++;
      emailSystem.lastError = sendError;
      
      if (sendError.code === 401 && 
          sendError.response && 
          sendError.response.body && 
          sendError.response.body.errors && 
          sendError.response.body.errors.length > 0 && 
          sendError.response.body.errors[0].message === 'Maximum credits exceeded') {
        
        console.warn("⚠️ Mailgun account has exceeded maximum email credits. Email delivery will be disabled.");
        emailSystem.hasCredits = false;
        emailSystem.maxCreditsExceeded = true;
        emailSystem.errorMessage = "Mailgun account has exceeded maximum email credits. Email delivery is currently unavailable.";
      } else {
        emailSystem.errorMessage = sendError.message || "Unknown error occurred while sending email";
      }
      return false;
    }
  } catch (error) {
    console.error('Error preparing privacy policy acceptance notification email:', error);
    return false;
  }
}

// Initialize Mailgun
// Prefer MAILGUN_SENDING_KEY for sending emails (more secure), fallback to MAILGUN_API_KEY
const mailgunKey = process.env.MAILGUN_SENDING_KEY || process.env.MAILGUN_API_KEY;
const keyType = process.env.MAILGUN_SENDING_KEY ? 'Sending Key' : 'API Key';

if (mailgunKey && process.env.MAILGUN_DOMAIN) {
  try {
    mg = mailgun.client({
      username: 'api',
      key: mailgunKey,
    });
    
    emailSystem.isConfigured = true;
    isMailgunConfigured = true;
    console.log(`✅ Mailgun initialized successfully (using ${keyType})`);
    console.log(`✅ Mailgun domain: ${process.env.MAILGUN_DOMAIN}`);
    
    // Verify the API key works
    checkMailgunApiKey()
      .then(isValid => {
        if (isValid) {
          console.log("✅ Mailgun API key validated successfully");
          emailSystem.hasCredits = true;
          emailSystem.maxCreditsExceeded = false;
        } else {
          console.warn("⚠️ Mailgun API key validation failed");
        }
      })
      .catch(error => {
        console.error("❌ Mailgun API key validation error:", error);
        emailSystem.lastError = error;
        emailSystem.errorMessage = error.message || "Mailgun API key validation failed";
      });
      
  } catch (error) {
    console.error("❌ Failed to initialize Mailgun:", error);
    console.error("Mailgun initialization error details:", JSON.stringify(error));
  }
} else {
  console.warn("⚠️ MAILGUN_API_KEY or MAILGUN_DOMAIN not found. Email notifications will not be available.");
}

// Log email configuration details
console.log(`Verified sender email: ${VERIFIED_SENDER_EMAIL}`);
console.log(`Admin email: ${ADMIN_EMAIL}`);
console.log("====== EMAIL SYSTEM INITIALIZATION COMPLETE ======");

/**
 * Helper function to send emails via Mailgun
 * Replaces sendEmail calls with Mailgun API
 */
async function sendEmail(emailData: {
  to: string | string[];
  from: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content?: Buffer;
    path?: string;
    contentType?: string;
  }>;
}): Promise<any> {
  if (!mg || !process.env.MAILGUN_DOMAIN) {
    throw new Error('Mailgun is not configured');
  }

  const toAddresses = Array.isArray(emailData.to) ? emailData.to : [emailData.to];

  const messageData: any = {
    from: emailData.from,
    to: toAddresses,
    subject: emailData.subject,
    text: emailData.text,
    html: emailData.html,
    'h:List-Unsubscribe': `<mailto:${VERIFIED_SENDER_EMAIL}?subject=unsubscribe>`,
    'h:List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    'h:X-Mailer': 'Urban Culture Hub Outreach',
    'h:Precedence': 'bulk',
  };

  if (emailData.replyTo) {
    messageData['h:Reply-To'] = emailData.replyTo;
  }

  if (emailData.attachments && emailData.attachments.length > 0) {
    messageData.attachment = emailData.attachments.map(att => ({
      filename: att.filename,
      data: att.content || (att.path ? fs.readFileSync(att.path) : undefined),
      contentType: att.contentType,
    }));
  }

  return await mg.messages.create(process.env.MAILGUN_DOMAIN, messageData);
}

/**
 * Debug logging for email operations
 * This helps track and diagnose email-related issues in the application
 * @param operation - The email operation being performed
 * @param details - Details about the operation
 * @param success - Whether the operation was successful
 * @param error - Error details if the operation failed
 */
export function logEmailOperation(
  operation: string,
  details: Record<string, any>,
  success: boolean,
  error: Error | null = null
): void {
  // Always log email operations for better diagnostics
  // if (!emailSystem.debug) return; // Commented out to ensure all email operations are logged
  
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    operation,
    success,
    details,
    error: error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : null
  };
  
  // Add to the debug logs array (limited to 100 most recent entries)
  emailSystem.debugLogs.unshift(JSON.stringify(logEntry));
  if (emailSystem.debugLogs.length > 100) {
    emailSystem.debugLogs.pop();
  }
  
  // Also log to console for immediate visibility
  if (success) {
    console.log(`📧 EMAIL [${operation}] Success:`, details);
  } else {
    console.error(`📧 EMAIL [${operation}] Failed:`, details, error);
  }
}

/**
 * Enable or disable detailed email debugging
 * @param enable - Whether to enable detailed debugging
 */
export function setEmailDebugMode(enable: boolean): void {
  emailSystem.debug = enable;
  console.log(`Email system debug mode: ${enable ? 'ENABLED' : 'DISABLED'}`);
  
  if (enable) {
    // Clear existing logs when enabling debug mode
    emailSystem.debugLogs = [];
  }
}

/**
 * Send a generic email with customizable content
 * This function can be used for administrative notifications and other custom emails
 */
export async function sendGenericEmail({
  to,
  subject,
  html,
  text,
  replyTo
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}): Promise<boolean> {
  if (!isMailgunConfigured) {
    console.warn("Mailgun is not configured. Generic email will not be sent.");
    return false;
  }

  // Check if we have exceeded Mailgun free tier credits
  if (emailSystem.maxCreditsExceeded) {
    console.warn("Mailgun maximum credits exceeded. Generic email will not be sent.");
    return false;
  }

  // Strip HTML tags to generate a clean plain text version
  const plainText = (text || html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>?/gm, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Prepare the email message
  const msg = {
    to,
    from: VERIFIED_SENDER_DISPLAY,
    subject,
    text: plainText,
    html,
    replyTo: replyTo || VERIFIED_SENDER_EMAIL
  };

  try {
    // Send email
    await sendEmail(msg);
    console.log(`Generic email sent to ${to} with subject: ${subject}`);
    emailSystem.successfulAttempts++;
    emailSystem.totalAttempts++;
    
    return true;
  } catch (sendError: any) {
    console.error('Error sending generic email:', sendError);
    emailSystem.failedAttempts++;
    emailSystem.totalAttempts++;
    emailSystem.lastError = sendError;
    
    if (sendError.code === 401 && 
        sendError.response && 
        sendError.response.body && 
        sendError.response.body.errors && 
        sendError.response.body.errors.length > 0 && 
        sendError.response.body.errors[0].message === 'Maximum credits exceeded') {
      
      console.warn("⚠️ Mailgun account has exceeded maximum email credits. Email delivery will be disabled.");
      emailSystem.hasCredits = false;
      emailSystem.maxCreditsExceeded = true;
      emailSystem.errorMessage = "Mailgun account has exceeded maximum email credits. Email delivery is currently unavailable.";
    } else {
      emailSystem.errorMessage = sendError.message || "Unknown error occurred while sending email";
    }
    
    return false;
  }
}

/**
 * Send a contact form submission notification email
 */
export async function sendContactFormNotification(submission: ContactSubmission): Promise<boolean> {
  if (!isMailgunConfigured) {
    console.warn("Mailgun is not configured. Contact form notification email will not be sent.");
    return false;
  }

  // Check if we have exceeded Mailgun free tier credits
  if (emailSystem.maxCreditsExceeded) {
    console.warn("Mailgun maximum credits exceeded. Contact form notification email will not be sent.");
    return false;
  }

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">New Contact Form Submission</h1>
      
      <div style="background-color: #f7f7f7; border-left: 4px solid #4a90e2; padding: 15px; margin: 20px 0;">
        <h2 style="color: #4a90e2; margin-top: 0;">Submission Details</h2>
        <p><strong>Name:</strong> ${submission.name}</p>
        <p><strong>Email:</strong> ${submission.email}</p>
        <p><strong>Subject:</strong> ${submission.subject}</p>
        <p><strong>Category:</strong> ${submission.category}</p>
        <p><strong>Date:</strong> ${new Date(submission.createdAt).toLocaleString()}</p>
      </div>
      
      <div style="margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-radius: 5px;">
        <h3 style="margin-top: 0;">Message:</h3>
        <p style="white-space: pre-wrap;">${submission.message}</p>
      </div>
      
      <div style="color: #666; font-size: 14px; margin-top: 30px; border-top: 1px solid #eaeaea; padding-top: 20px;">
        <p>This is an automated notification from your Urban Culture platform.</p>
        <p>You can reply directly to the sender by emailing them at: ${submission.email}</p>
      </div>
    </div>
  `;

  // Email to admin
  const adminMsg = {
    to: ADMIN_EMAIL,
    from: VERIFIED_SENDER_EMAIL,
    subject: `Urban Culture: New Contact Form - ${submission.subject}`,
    text: emailHtml.replace(/<[^>]*>?/gm, ''),
    html: emailHtml,
    replyTo: submission.email, // Allow admin to reply directly to the sender
  };

  try {
    // Send notification to the admin
    await sendEmail(adminMsg);
    console.log(`Sent contact form notification email to ${ADMIN_EMAIL} for submission #${submission.id}`);
    emailSystem.successfulAttempts++;
    emailSystem.totalAttempts++;
    
    return true;
  } catch (sendError: any) {
    console.error('Error sending contact form notification email:', sendError);
    emailSystem.failedAttempts++;
    emailSystem.totalAttempts++;
    emailSystem.lastError = sendError;
    
    if (sendError.code === 401 && 
        sendError.response && 
        sendError.response.body && 
        sendError.response.body.errors && 
        sendError.response.body.errors.length > 0 && 
        sendError.response.body.errors[0].message === 'Maximum credits exceeded') {
      
      console.warn("⚠️ Mailgun account has exceeded maximum email credits. Email delivery will be disabled.");
      emailSystem.hasCredits = false;
      emailSystem.maxCreditsExceeded = true;
      emailSystem.errorMessage = "Mailgun account has exceeded maximum email credits. Email delivery is currently unavailable.";
    } else {
      emailSystem.errorMessage = sendError.message || "Unknown error occurred while sending email";
    }
    
    return false;
  }
}

/**
 * Generate a PDF ticket
 */
export async function generatePDFTicket(
  user: User,
  event: Event,
  ticketId: number,
  qrCodeData: string
): Promise<Buffer> {
  console.log(`PDF TICKET DEBUG: Starting PDF generation for ticket ID: ${ticketId}`);
  console.log(`PDF TICKET DEBUG: QR code data length: ${qrCodeData?.length || 0}`);
  console.log(`PDF TICKET DEBUG: QR code data prefix: ${qrCodeData?.substring(0, 50) || 'N/A'}`);
  
  return new Promise((resolve, reject) => {
    try {
      // Validate QR code data
      if (!qrCodeData || !qrCodeData.includes(',')) {
        console.error('PDF TICKET ERROR: Invalid QR code data format');
        reject(new Error('Invalid QR code data format'));
        return;
      }

      // Create a temporary file path
      const tempFilePath = path.join(
        os.tmpdir(),
        `ticket-${ticketId}-${Date.now()}.pdf`
      );
      console.log(`PDF TICKET DEBUG: Temp file path: ${tempFilePath}`);

      // Create a PDF document with proper buffering
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        bufferPages: true,
        autoFirstPage: true,
        info: {
          Title: `Ticket - ${event.title}`,
          Author: 'Urban Culture',
          Subject: 'Event Ticket',
          Creator: 'Urban Culture Ticketing System',
        },
      });

      // Collect PDF data in memory buffer for reliable output
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      
      // Also write to file as backup
      const stream = fs.createWriteStream(tempFilePath);
      doc.pipe(stream);

      // Draw a border around the ticket first
      doc.lineWidth(2);
      doc.strokeColor('#333333');
      doc.roundedRect(40, 40, doc.page.width - 80, doc.page.height - 80, 10).stroke();

      // Header section
      const headerY = 60;
      doc.fontSize(28).font('Helvetica-Bold').fillColor('#1a1a1a').text('URBAN CULTURE', 50, headerY, { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(20).font('Helvetica-Bold').fillColor('#4a90e2').text('EVENT TICKET', { align: 'center' });
      doc.moveDown(0.5);

      // Add a horizontal line
      doc.strokeColor('#4a90e2').lineWidth(1);
      doc.moveTo(70, doc.y).lineTo(doc.page.width - 70, doc.y).stroke();
      doc.moveDown(0.5);

      // Event title
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#333333').text(event.title, { align: 'center' });
      doc.moveDown(1);

      // Add QR code image with validation
      try {
        const base64Data = qrCodeData.split(',')[1];
        if (!base64Data) {
          throw new Error('No base64 data found in QR code');
        }
        const qrImage = Buffer.from(base64Data, 'base64');
        console.log(`PDF TICKET DEBUG: QR image buffer size: ${qrImage.length}`);
        
        // Center the QR code
        const qrSize = 180;
        const qrX = (doc.page.width - qrSize) / 2;
        doc.image(qrImage, qrX, doc.y, { width: qrSize, height: qrSize });
        doc.y += qrSize + 10;
        
        // Add scan instruction below QR code
        doc.fontSize(10).font('Helvetica').fillColor('#666666').text('Scan this QR code at the event entrance', { align: 'center' });
        doc.moveDown(1);
      } catch (qrError) {
        console.error('PDF TICKET ERROR: Failed to add QR code to PDF:', qrError);
        doc.fontSize(12).font('Helvetica').fillColor('#ff0000').text('QR Code Generation Error', { align: 'center' });
        doc.moveDown(1);
      }

      // Ticket Info section
      const contentMargin = 70;
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#333333').text('TICKET INFORMATION', contentMargin, doc.y + 10);
      doc.moveDown(0.3);
      
      // Add a line under the section header
      doc.strokeColor('#dddddd').lineWidth(0.5);
      doc.moveTo(contentMargin, doc.y).lineTo(doc.page.width - contentMargin, doc.y).stroke();
      doc.moveDown(0.5);

      // Create a table-like structure for ticket details
      const detailsX = contentMargin;
      const valueX = contentMargin + 130;
      let detailsY = doc.y;

      doc.fontSize(11).font('Helvetica-Bold').fillColor('#555555').text('Ticket ID:', detailsX, detailsY);
      doc.font('Helvetica').fillColor('#333333').text(`#${ticketId}`, valueX, detailsY);
      detailsY += 24;

      doc.font('Helvetica-Bold').fillColor('#555555').text('Attendee:', detailsX, detailsY);
      doc.font('Helvetica').fillColor('#333333').text(user.displayName || 'Guest', valueX, detailsY);
      detailsY += 24;

      doc.font('Helvetica-Bold').fillColor('#555555').text('Event Date:', detailsX, detailsY);
      doc.font('Helvetica').fillColor('#333333').text(new Date(event.date).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }), valueX, detailsY);
      detailsY += 24;

      doc.font('Helvetica-Bold').fillColor('#555555').text('Location:', detailsX, detailsY);
      doc.font('Helvetica').fillColor('#333333').text(event.location || 'TBD', valueX, detailsY);
      detailsY += 24;
      
      // Update doc.y position
      doc.y = detailsY;

      // Terms and Conditions section
      doc.moveDown(1.5);
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#333333').text('TERMS AND CONDITIONS', contentMargin);
      doc.moveDown(0.3);
      doc.strokeColor('#dddddd').lineWidth(0.5);
      doc.moveTo(contentMargin, doc.y).lineTo(doc.page.width - contentMargin, doc.y).stroke();
      doc.moveDown(0.4);
      
      doc.fontSize(9).font('Helvetica').fillColor('#666666');
      doc.text('1. This ticket is issued subject to the terms and conditions of the venue.', contentMargin);
      doc.text('2. This ticket is not transferable and is valid only for the named attendee.', contentMargin);
      doc.text('3. The QR code must be presented at the venue entrance for validation.', contentMargin);
      doc.text('4. The organizer reserves the right to refuse entry if terms are not adhered to.', contentMargin);

      // Footer
      doc.fontSize(8).fillColor('#999999');
      doc.text(`Urban Culture - ${VERIFIED_SENDER_EMAIL}`, contentMargin, doc.page.height - 80, { align: 'center' });
      doc.text('This ticket was generated on ' + new Date().toLocaleString(), { align: 'center' });

      // Finalize the document
      doc.end();

      // Wait for the document to finish writing and collect buffer
      doc.on('end', () => {
        console.log(`PDF TICKET DEBUG: PDF generation completed`);
        const pdfBuffer = Buffer.concat(chunks);
        console.log(`PDF TICKET DEBUG: Final PDF buffer size: ${pdfBuffer.length}`);

        // Clean up temporary files
        try {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
        } catch (cleanupError) {
          console.error('Error cleaning up temporary files:', cleanupError);
        }

        resolve(pdfBuffer);
      });

      stream.on('error', (error) => {
        console.error('PDF TICKET ERROR: Stream error:', error);
        reject(error);
      });
    } catch (error) {
      console.error('PDF TICKET ERROR: Exception during PDF generation:', error);
      reject(error);
    }
  });
}

/**
 * Send a ticket confirmation email with PDF attachment
 */
export async function sendTicketConfirmationEmail(
  user: User,
  event: Event,
  ticketId: number,
  qrCodeData: string
): Promise<boolean> {
  if (!isMailgunConfigured) {
    console.warn("Mailgun is not configured. Ticket confirmation email will not be sent.");
    return false;
  }

  // Check if we have exceeded Mailgun free tier credits
  if (emailSystem.maxCreditsExceeded) {
    console.warn("Mailgun maximum credits exceeded. Ticket confirmation email will not be sent.");
    return false;
  }

  try {
    // Generate the PDF ticket
    const pdfBuffer = await generatePDFTicket(user, event, ticketId, qrCodeData);

    // Format event date for display
    const eventDate = new Date(event.date);
    const formattedDate = eventDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">Your Ticket is Ready!</h1>
        <p>Hello ${user.displayName},</p>
        <p>Thank you for purchasing a ticket to <strong>${event.title}</strong>! Your ticket is attached to this email as a PDF document.</p>

        <div style="background-color: #f7f7f7; border-left: 4px solid #4a90e2; padding: 15px; margin: 20px 0;">
          <h2 style="color: #4a90e2; margin-top: 0;">Event Details</h2>
          <p><strong>Event:</strong> ${event.title}</p>
          <p><strong>Date:</strong> ${formattedDate}</p>
          <p><strong>Location:</strong> ${event.location}</p>
          <p><strong>Ticket ID:</strong> #${ticketId}</p>
        </div>

        <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #f0f8ff; border-radius: 5px;">
          <p><strong>Important Instructions:</strong></p>
          <p>1. Download and print your ticket or keep it on your mobile device.</p>
          <p>2. Present the QR code at the event entrance for scanning.</p>
          <p>3. Arrive at least 30 minutes before the event starts.</p>
        </div>

        <div style="color: #666; font-size: 14px; margin-top: 30px; border-top: 1px solid #eaeaea; padding-top: 20px;">
          <p>If you have any questions, please contact the event organizer.</p>
          <p>We hope you enjoy the event!</p>
          <p>Urban Culture Team</p>
        </div>
      </div>
    `;

    // Email to the user
    const userMsg = {
      to: user.email,
      from: VERIFIED_SENDER_EMAIL,
      subject: `Your Ticket - ${event.title}`,
      text: `Your ticket for ${event.title} on ${formattedDate} at ${event.location} is attached.`,
      html: emailHtml,
      attachments: [
        {
          content: pdfBuffer,
          filename: `Ticket-${ticketId}-${event.title.replace(/[^a-z0-9]/gi, '-')}.pdf`,
          contentType: 'application/pdf',
        },
      ],
    };

    // Email to the admin
    const adminEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">New Ticket Purchase</h1>
        <p>A new ticket has been purchased.</p>

        <div style="background-color: #f7f7f7; border-left: 4px solid #4a90e2; padding: 15px; margin: 20px 0;">
          <h2 style="color: #4a90e2; margin-top: 0;">Ticket Details</h2>
          <p><strong>Ticket ID:</strong> #${ticketId}</p>
          <p><strong>Event:</strong> ${event.title}</p>
          <p><strong>Date:</strong> ${formattedDate}</p>
          <p><strong>Purchaser:</strong> ${user.displayName} (${user.email})</p>
        </div>

        <div style="color: #666; font-size: 14px; margin-top: 30px; border-top: 1px solid #eaeaea; padding-top: 20px;">
          <p>This is an automated notification from your Urban Culture platform.</p>
        </div>
      </div>
    `;

    const adminMsg = {
      to: VERIFIED_SENDER_EMAIL,
      from: VERIFIED_SENDER_EMAIL,
      subject: `Admin Notification: New Ticket Purchase - #${ticketId}`,
      text: `New ticket purchase: #${ticketId} for ${event.title} by ${user.displayName} (${user.email}).`,
      html: adminEmailHtml,
      attachments: [
        {
          content: pdfBuffer,
          filename: `Ticket-${ticketId}-${event.title.replace(/[^a-z0-9]/gi, '-')}.pdf`,
          contentType: 'application/pdf',
        },
      ],
    };

    try {
      // Send the email to the user
      await sendEmail(userMsg);
      console.log(`Sent ticket confirmation email to ${user.email}`);
      emailSystem.successfulAttempts++;
      emailSystem.totalAttempts++;

      // Only send the admin notification if the user email is different from the admin email
      // This avoids duplicate emails to the same address
      if (user.email !== VERIFIED_SENDER_EMAIL) {
        await sendEmail(adminMsg);
        console.log(`Sent ticket confirmation email to ${VERIFIED_SENDER_EMAIL}`);
        emailSystem.successfulAttempts++;
        emailSystem.totalAttempts++;
      } else {
        console.log(`User email is the same as admin email, skipping duplicate notification`);
      }
      
      return true;
    } catch (sendError: any) {
      console.error('Error sending ticket confirmation email:', sendError);
      emailSystem.failedAttempts++;
      emailSystem.totalAttempts++;
      emailSystem.lastError = sendError;
      
      // Check if the error is due to maximum credits exceeded
      if (sendError.code === 401 && 
          sendError.response && 
          sendError.response.body && 
          sendError.response.body.errors && 
          sendError.response.body.errors.length > 0 && 
          sendError.response.body.errors[0].message === 'Maximum credits exceeded') {
        
        console.warn("⚠️ Mailgun account has exceeded maximum email credits. Email delivery will be disabled.");
        emailSystem.hasCredits = false;
        emailSystem.maxCreditsExceeded = true;
        emailSystem.errorMessage = "Mailgun account has exceeded maximum email credits. Email delivery is currently unavailable.";
      } else {
        emailSystem.errorMessage = sendError.message || "Unknown error occurred while sending email";
      }
      
      return false;
    }
  } catch (error) {
    console.error('Error generating ticket PDF or preparing email:', error);
    return false;
  }
}

/**
 * Generate a PDF booking confirmation
 */
export async function generatePDFBooking(
  user: User, 
  service: Service, 
  booking: ServiceBooking
): Promise<Buffer> {
  console.log(`PDF DEBUG: Starting PDF generation for booking ID: ${booking.id}`);
  console.log(`PDF DEBUG: User: ${user.id}, ${user.email}, ${user.displayName}`);
  console.log(`PDF DEBUG: Service: ${service.id}, ${service.name}`);

  return new Promise((resolve, reject) => {
    try {
      // Create a temporary file path
      const tempDir = os.tmpdir();
      console.log(`PDF DEBUG: Using temporary directory: ${tempDir}`);
      const tempFilePath = path.join(
        tempDir,
        `booking-${booking.id}-${Date.now()}.pdf`
      );
      console.log(`PDF DEBUG: Created temporary file path: ${tempFilePath}`);

      // Create a PDF document
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Booking Confirmation - ${service.name}`,
          Author: 'Urban Culture',
          Subject: 'Service Booking',
        },
      });

      // Pipe the PDF document to a writable stream
      const stream = fs.createWriteStream(tempFilePath);
      doc.pipe(stream);

      // Format dates
      const startDate = new Date(booking.startTime);
      const endDate = new Date(booking.endTime);

      const formattedStartDate = startDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });

      const formattedStartTime = startDate.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      const formattedEndTime = endDate.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      // Draw a border around the document
      doc.lineWidth(2);
      doc.roundedRect(50, 50, doc.page.width - 100, doc.page.height - 100, 10).stroke();

      // Add padding inside the border
      const margin = 70;

      // Header
      doc.fontSize(24).font('Helvetica-Bold').text('URBAN CULTURE', margin, margin, { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(18).font('Helvetica-Bold').text('BOOKING CONFIRMATION', { align: 'center' });
      doc.moveDown(1);

      // Service Name
      doc.fontSize(16).font('Helvetica-Bold').text(service.name, { align: 'center' });
      doc.moveDown(1);

      // Booking Info
      doc.fontSize(12).font('Helvetica-Bold').text('BOOKING INFORMATION', { underline: true });
      doc.moveDown(0.5);

      // Create a table-like structure for booking details
      const detailsX = margin;
      let detailsY = doc.y;

      doc.font('Helvetica-Bold').text('Booking ID:', detailsX, detailsY);
      doc.font('Helvetica').text(`#${booking.id}`, detailsX + 150, detailsY);
      detailsY += 20;

      doc.font('Helvetica-Bold').text('Customer:', detailsX, detailsY);
      doc.font('Helvetica').text(user.displayName, detailsX + 150, detailsY);
      detailsY += 20;

      doc.font('Helvetica-Bold').text('Date:', detailsX, detailsY);
      doc.font('Helvetica').text(formattedStartDate, detailsX + 150, detailsY);
      detailsY += 20;

      doc.font('Helvetica-Bold').text('Time:', detailsX, detailsY);
      doc.font('Helvetica').text(`${formattedStartTime} - ${formattedEndTime}`, detailsX + 150, detailsY);
      detailsY += 20;

      doc.font('Helvetica-Bold').text('Location:', detailsX, detailsY);
      doc.font('Helvetica').text(booking.location || service.location || 'To be confirmed', detailsX + 150, detailsY);
      detailsY += 20;

      doc.font('Helvetica-Bold').text('Participants:', detailsX, detailsY);
      doc.font('Helvetica').text(booking.participants?.toString() || '1', detailsX + 150, detailsY);
      detailsY += 20;

      doc.font('Helvetica-Bold').text('Total Price:', detailsX, detailsY);
      doc.font('Helvetica').text(`€${parseFloat(booking.totalPrice?.toString() || '0').toFixed(2)}`, detailsX + 150, detailsY);
      detailsY += 20;

      doc.font('Helvetica-Bold').text('Status:', detailsX, detailsY);
      doc.font('Helvetica').text(booking.status || 'pending', detailsX + 150, detailsY);
      detailsY += 20;

      // Service Description
      doc.moveDown(1);
      doc.fontSize(12).font('Helvetica-Bold').text('SERVICE DESCRIPTION', { underline: true });
      doc.moveDown(0.5);
      doc.font('Helvetica').text(service.description || 'No description provided.');

      // Additional Notes
      if (booking.message) {
        doc.moveDown(1);
        doc.fontSize(12).font('Helvetica-Bold').text('YOUR MESSAGE', { underline: true });
        doc.moveDown(0.5);
        doc.font('Helvetica').text(booking.message);
      }

      // Terms and Conditions
      doc.moveDown(1);
      doc.fontSize(10).font('Helvetica-Bold').text('TERMS AND CONDITIONS', { underline: true });
      doc.moveDown(0.5);
      doc.font('Helvetica').text('1. Cancellation policy: Cancellations must be made at least 24 hours in advance.');
      doc.text('2. Payment has been processed for this booking.');
      doc.text('3. The service provider reserves the right to modify or cancel the booking if necessary.');

      // Footer
      doc.fontSize(8).text(`Urban Culture - ${VERIFIED_SENDER_EMAIL}`, margin, doc.page.height - 70, { align: 'center' });
      doc.text('This booking confirmation was generated on ' + new Date().toLocaleString(), { align: 'center' });

      // Finalize the document
      doc.end();

      // Wait for the stream to finish writing
      stream.on('finish', () => {
        console.log(`PDF DEBUG: Stream finished writing to ${tempFilePath}`);

        try {
          // Check if file exists
          if (!fs.existsSync(tempFilePath)) {
            console.error(`PDF ERROR: File ${tempFilePath} does not exist after stream finish event`);
            reject(new Error(`PDF file ${tempFilePath} does not exist after generation`));
            return;
          }

          console.log(`PDF DEBUG: File exists, size: ${fs.statSync(tempFilePath).size} bytes`);

          // Read the file into a buffer
          const pdfBuffer = fs.readFileSync(tempFilePath);
          console.log(`PDF DEBUG: Successfully read file into buffer, size: ${pdfBuffer.length} bytes`);

          // Clean up temporary file
          try {
            fs.unlinkSync(tempFilePath);
            console.log(`PDF DEBUG: Temporary file ${tempFilePath} deleted successfully`);
          } catch (cleanupError) {
            console.error(`PDF ERROR: Error cleaning up temporary file ${tempFilePath}:`, cleanupError);
            // Continue despite cleanup error
          }

          resolve(pdfBuffer);
        } catch (fileError) {
          console.error(`PDF ERROR: Error processing PDF file ${tempFilePath}:`, fileError);
          reject(fileError);
        }
      });

      stream.on('error', (error) => {
        console.error(`PDF ERROR: Stream error for ${tempFilePath}:`, error);
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Send a service booking confirmation email to the customer
 */
export async function sendBookingConfirmationEmail(
  user: User,
  service: Service,
  booking: ServiceBooking
): Promise<boolean> {
  // Log operation start with detailed info to help with debugging
  logEmailOperation("BOOKING_CONFIRMATION_START", {
    bookingId: booking.id,
    userId: user?.id,
    userEmail: user?.email,
    serviceId: service?.id,
    serviceName: service?.name,
    bookingStatus: booking?.status,
    timestamp: new Date().toISOString()
  }, true);
  
  if (!isMailgunConfigured) {
    logEmailOperation("BOOKING_CONFIRMATION_FAILED", {
      reason: "Mailgun not configured",
      bookingId: booking.id
    }, false);
    console.warn("Mailgun is not configured. Booking confirmation email will not be sent.");
    return false;
  }
  
  // Check if Mailgun free tier credits are exceeded
  if (emailSystem.maxCreditsExceeded) {
    logEmailOperation("BOOKING_CONFIRMATION_FAILED", {
      reason: "Mailgun maximum credits exceeded",
      bookingId: booking.id
    }, false);
    console.warn("Mailgun maximum credits exceeded. Booking confirmation email will not be sent.");
    return false;
  }
  
  if (!user?.email || !service?.name || !booking?.id) {
    const missingData = {
      hasUserEmail: !!user?.email,
      hasServiceName: !!service?.name,
      hasBookingId: !!booking?.id
    };
    
    logEmailOperation("BOOKING_CONFIRMATION_FAILED", {
      reason: "Missing required data",
      details: missingData,
      bookingId: booking?.id || "unknown"
    }, false);
    
    console.error("Missing required data for email:", missingData);
    return false;
  }

  try {
    logEmailOperation("BOOKING_CONFIRMATION_PDF_GENERATION_START", {
      bookingId: booking.id
    }, true);
    
    // Generate the PDF booking confirmation
    const pdfBuffer = await generatePDFBooking(user, service, booking);
    
    logEmailOperation("BOOKING_CONFIRMATION_PDF_GENERATION_SUCCESS", {
      bookingId: booking.id,
      pdfSize: pdfBuffer.length
    }, true);

    // Format the date and time for display
    const startDate = new Date(booking.startTime);
    const formattedDate = startDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const formattedTime = startDate.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    logEmailOperation("BOOKING_CONFIRMATION_EMAIL_TEMPLATE_START", {
      bookingId: booking.id
    }, true);
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">Booking Confirmation</h1>
        <p>Hello ${user.displayName},</p>
        <p>Thank you for booking <strong>${service.name}</strong>! Your booking confirmation is attached to this email as a PDF document.</p>

        <div style="background-color: #f7f7f7; border-left: 4px solid #4a90e2; padding: 15px; margin: 20px 0;">
          <h2 style="color: #4a90e2; margin-top: 0;">Booking Details</h2>
          <p><strong>Service:</strong> ${service.name}</p>
          <p><strong>Date:</strong> ${formattedDate}</p>
          <p><strong>Time:</strong> ${formattedTime}</p>
          <p><strong>Location:</strong> ${booking.location || service.location || 'To be confirmed'}</p>
          <p><strong>Participants:</strong> ${booking.participants}</p>
          <p><strong>Total Price:</strong> €${parseFloat(booking.totalPrice.toString()).toFixed(2)}</p>
          <p><strong>Booking ID:</strong> #${booking.id}</p>
          <p><strong>Status:</strong> ${booking.status || 'pending'}</p>
        </div>

        <div style="margin: 30px 0;">
          <p><strong>Description:</strong></p>
          <p>${service.description || 'No description provided.'}</p>
        </div>

        <div style="color: #666; font-size: 14px; margin-top: 30px; border-top: 1px solid #eaeaea; padding-top: 20px;">
          <p>If you have any questions or need to make changes to your booking, please contact the service provider.</p>
          <p>We hope you enjoy the service!</p>
          <p>Urban Culture Team</p>
        </div>
      </div>
    `;

    logEmailOperation("BOOKING_CONFIRMATION_EMAIL_TEMPLATE_SUCCESS", {
      bookingId: booking.id,
      templateSize: emailHtml.length
    }, true);

    const msg = {
      to: user.email,
      from: VERIFIED_SENDER_EMAIL,
      subject: `Payment Successful: Booking Confirmation for ${service.name}`,
      text: emailHtml.replace(/<[^>]*>?/gm, ''),
      html: emailHtml,
      attachments: [
        {
          content: pdfBuffer.toString('base64'),
          filename: `Booking-${booking.id}-${service.name.replace(/[^a-z0-9]/gi, '-')}.pdf`,
          type: 'application/pdf',
          disposition: 'attachment',
        },
      ],
    };

    logEmailOperation("BOOKING_CONFIRMATION_SENDGRID_REQUEST_START", {
      bookingId: booking.id,
      recipient: user.email,
      sender: VERIFIED_SENDER_EMAIL,
      subject: msg.subject,
      hasAttachment: !!msg.attachments?.length
    }, true);

    // Always send the email to the user regardless of whether they match the admin email
    try {
      const response = await sendEmail(msg);
      
      logEmailOperation("BOOKING_CONFIRMATION_SENDGRID_REQUEST_SUCCESS", {
        bookingId: booking.id,
        recipient: user.email,
        responseCode: response?.[0]?.statusCode || 'unknown',
        responseMessage: response?.[0]?.statusMessage || 'unknown',
        responseHeaders: JSON.stringify(response?.[0]?.headers || {})
      }, true);
      
      emailSystem.successfulAttempts++;
      emailSystem.totalAttempts++;
      return true;
    } catch (sendGridError: any) {
      // Detailed error logging
      logEmailOperation("BOOKING_CONFIRMATION_SENDGRID_REQUEST_FAILED", {
        bookingId: booking.id,
        recipient: user.email,
        errorCode: sendGridError.code || 'unknown',
        errorMessage: sendGridError.message || 'unknown',
        errorResponse: JSON.stringify(sendGridError.response?.body || {}),
        errorStack: sendGridError.stack || 'unknown',
        timestamp: new Date().toISOString()
      }, false);
      
      emailSystem.failedAttempts++;
      emailSystem.totalAttempts++;
      emailSystem.lastError = sendGridError;
      
      // Check if the error is due to maximum credits exceeded
      if (sendGridError.code === 401 && 
          sendGridError.response && 
          sendGridError.response.body && 
          sendGridError.response.body.errors && 
          sendGridError.response.body.errors.length > 0 && 
          sendGridError.response.body.errors[0].message === 'Maximum credits exceeded') {
        
        logEmailOperation("BOOKING_CONFIRMATION_SENDGRID_CREDITS_EXCEEDED", {
          bookingId: booking.id,
          errorResponse: JSON.stringify(sendGridError.response?.body || {})
        }, false);
        
        emailSystem.hasCredits = false;
        emailSystem.maxCreditsExceeded = true;
        emailSystem.errorMessage = "Mailgun account has exceeded maximum email credits. Email delivery is currently unavailable.";
      } else {
        emailSystem.errorMessage = sendGridError.message || "Unknown error occurred while sending email";
        if (sendGridError.response) {
          console.error("Mailgun error response:", sendGridError.response.body);
        }
      }
      throw sendGridError; // Re-throw to be caught by outer catch
    }
  } catch (error: any) {
    logEmailOperation("BOOKING_CONFIRMATION_FAILED", {
      bookingId: booking.id,
      errorMessage: error?.message || 'Unknown error',
      errorType: error?.name || 'Unknown type',
      errorStack: error?.stack || 'No stack trace available',
      timestamp: new Date().toISOString()
    }, false);
    
    console.error('Error sending booking confirmation email:', error);
    return false;
  }
}

/**
 * Send a service booking confirmation email to the service provider
 */
export async function sendProviderNotificationEmail(
  provider: User,
  customer: User,
  service: Service,
  booking: ServiceBooking
): Promise<boolean> {
  // Log operation start with detailed info to help with debugging
  logEmailOperation("PROVIDER_NOTIFICATION_START", {
    bookingId: booking.id,
    providerId: provider?.id,
    providerEmail: provider?.email,
    customerId: customer?.id,
    customerEmail: customer?.email,
    serviceId: service?.id,
    serviceName: service?.name,
    bookingStatus: booking?.status,
    timestamp: new Date().toISOString()
  }, true);

  if (!isMailgunConfigured) {
    logEmailOperation("PROVIDER_NOTIFICATION_FAILED", {
      reason: "Mailgun not configured",
      bookingId: booking.id,
      providerId: provider?.id
    }, false);
    console.warn("Mailgun is not configured. Provider notification email will not be sent.");
    return false;
  }
  
  // Check if Mailgun free tier credits are exceeded
  if (emailSystem.maxCreditsExceeded) {
    logEmailOperation("PROVIDER_NOTIFICATION_FAILED", {
      reason: "Mailgun maximum credits exceeded",
      bookingId: booking.id,
      providerId: provider?.id
    }, false);
    console.warn("Mailgun maximum credits exceeded. Provider notification email will not be sent.");
    return false;
  }

  try {
    // Format the date and time for display
    const startDate = new Date(booking.startTime);
    const formattedDate = startDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const formattedTime = startDate.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    logEmailOperation("PROVIDER_NOTIFICATION_EMAIL_TEMPLATE_START", {
      bookingId: booking.id,
      providerId: provider?.id
    }, true);
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">New Booking Notification</h1>
        <p>Hello ${provider.displayName},</p>
        <p>You have received a new booking for <strong>${service.name}</strong>!</p>

        <div style="background-color: #f7f7f7; border-left: 4px solid #4a90e2; padding: 15px; margin: 20px 0;">
          <h2 style="color: #4a90e2; margin-top: 0;">Booking Details</h2>
          <p><strong>Service:</strong> ${service.name}</p>
          <p><strong>Date:</strong> ${formattedDate}</p>
          <p><strong>Time:</strong> ${formattedTime}</p>
          <p><strong>Location:</strong> ${booking.location || service.location || 'To be confirmed'}</p>
          <p><strong>Participants:</strong> ${booking.participants}</p>
          <p><strong>Total Price:</strong> €${parseFloat(booking.totalPrice.toString()).toFixed(2)}</p>
          <p><strong>Booking ID:</strong> #${booking.id}</p>
        </div>

        <div style="background-color: #eef6ff; padding: 15px; margin: 20px 0; border-left: 4px solid #0066cc;">
          <h2 style="color: #0066cc; margin-top: 0;">Customer Information</h2>
          <p><strong>Name:</strong> ${customer.displayName}</p>
          <p><strong>Email:</strong> ${customer.email}</p>
          ${booking.message ? `<p><strong>Message:</strong> ${booking.message}</p>` : ''}
        </div>

        <div style="margin: 20px 0; background-color: #f9f9f9; padding: 15px; border-radius: 5px;">
          <p><strong>Action Required:</strong> Please log in to your account to approve, reject, or manage this booking.</p>
          <p>Visit: <a href="https://urbanculture.app/admin" style="color: #0066cc;">Admin Dashboard</a></p>
        </div>

        <div style="color: #666; font-size: 14px; margin-top: 30px; border-top: 1px solid #eaeaea; padding-top: 20px;">
          <p>Thank you for using our platform to manage your services.</p>
          <p>Urban Culture Team</p>
        </div>
      </div>
    `;

    logEmailOperation("PROVIDER_NOTIFICATION_EMAIL_TEMPLATE_SUCCESS", {
      bookingId: booking.id,
      providerId: provider?.id,
      templateSize: emailHtml.length
    }, true);

    const msg = {
      to: provider.email,
      from: VERIFIED_SENDER_EMAIL,
      subject: `New Booking Alert - ${service.name}`,
      text: emailHtml.replace(/<[^>]*>?/gm, ''),
      html: emailHtml,
    };

    logEmailOperation("PROVIDER_NOTIFICATION_SENDGRID_REQUEST_START", {
      bookingId: booking.id,
      providerId: provider?.id,
      recipient: provider.email,
      sender: VERIFIED_SENDER_EMAIL,
      subject: msg.subject
    }, true);

    // Always send email to provider regardless of whether they match the admin email
    try {
      const response = await sendEmail(msg);
      
      logEmailOperation("PROVIDER_NOTIFICATION_SENDGRID_REQUEST_SUCCESS", {
        bookingId: booking.id,
        providerId: provider?.id,
        recipient: provider.email,
        responseCode: response?.[0]?.statusCode || 'unknown',
        responseMessage: response?.[0]?.statusMessage || 'unknown',
        responseHeaders: JSON.stringify(response?.[0]?.headers || {})
      }, true);
      
      emailSystem.successfulAttempts++;
      emailSystem.totalAttempts++;
      return true;
    } catch (sendGridError: any) {
      // Detailed error logging
      logEmailOperation("PROVIDER_NOTIFICATION_SENDGRID_REQUEST_FAILED", {
        bookingId: booking.id,
        providerId: provider?.id,
        recipient: provider.email,
        errorCode: sendGridError.code || 'unknown',
        errorMessage: sendGridError.message || 'unknown',
        errorResponse: JSON.stringify(sendGridError.response?.body || {}),
        errorStack: sendGridError.stack || 'unknown',
        timestamp: new Date().toISOString()
      }, false);
      
      emailSystem.failedAttempts++;
      emailSystem.totalAttempts++;
      emailSystem.lastError = sendGridError;
      
      // Check if the error is due to maximum credits exceeded
      if (sendGridError.code === 401 && 
          sendGridError.response && 
          sendGridError.response.body && 
          sendGridError.response.body.errors && 
          sendGridError.response.body.errors.length > 0 && 
          sendGridError.response.body.errors[0].message === 'Maximum credits exceeded') {
        
        logEmailOperation("PROVIDER_NOTIFICATION_SENDGRID_CREDITS_EXCEEDED", {
          bookingId: booking.id,
          providerId: provider?.id,
          errorResponse: JSON.stringify(sendGridError.response?.body || {})
        }, false);
        
        emailSystem.hasCredits = false;
        emailSystem.maxCreditsExceeded = true;
        emailSystem.errorMessage = "Mailgun account has exceeded maximum email credits. Email delivery is currently unavailable.";
      } else {
        emailSystem.errorMessage = sendGridError.message || "Unknown error occurred while sending email";
        if (sendGridError.response) {
          console.error("Mailgun error response for provider email:", sendGridError.response.body);
        }
      }
      throw sendGridError; // Re-throw to be caught by outer catch
    }
  } catch (error: any) {
    logEmailOperation("PROVIDER_NOTIFICATION_FAILED", {
      bookingId: booking.id,
      providerId: provider?.id,
      errorMessage: error?.message || 'Unknown error',
      errorType: error?.name || 'Unknown type',
      errorStack: error?.stack || 'No stack trace available',
      timestamp: new Date().toISOString()
    }, false);
    
    console.error('Error sending booking confirmation email:', error);
    return false;
  }
}

/**
 * Send a booking status update email to the customer
 */
export async function sendBookingStatusUpdateEmail(
  user: User,
  service: Service,
  booking: ServiceBooking
): Promise<boolean> {
  // Log operation start with detailed info to help with debugging
  logEmailOperation("BOOKING_STATUS_UPDATE_START", {
    bookingId: booking.id,
    userId: user?.id,
    userEmail: user?.email,
    serviceId: service?.id,
    serviceName: service?.name,
    bookingStatus: booking?.status,
    timestamp: new Date().toISOString()
  }, true);

  if (!isMailgunConfigured) {
    logEmailOperation("BOOKING_STATUS_UPDATE_FAILED", {
      reason: "Mailgun not configured",
      bookingId: booking.id,
      userId: user?.id
    }, false);
    console.warn("Mailgun is not configured. Booking status update email will not be sent.");
    return false;
  }
  
  // Check if Mailgun free tier credits are exceeded
  if (emailSystem.maxCreditsExceeded) {
    logEmailOperation("BOOKING_STATUS_UPDATE_FAILED", {
      reason: "Mailgun maximum credits exceeded",
      bookingId: booking.id,
      userId: user?.id
    }, false);
    console.warn("Mailgun maximum credits exceeded. Booking status update email will not be sent.");
    return false;
  }

  try {
    // Format the date and time for display
    const startDate = new Date(booking.startTime);
    const formattedDate = startDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const formattedTime = startDate.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    // Determine message content based on booking status
    let statusTitle = '';
    let statusMessage = '';
    let statusColor = '';
    let additionalInfo = '';

    // Safely handle null/undefined booking status
    const bookingStatus = booking.status || 'pending';

    switch(bookingStatus) {
      case 'approved':
        statusTitle = 'Booking Approved';
        statusMessage = `Your booking for <strong>${service.name}</strong> has been approved!`;
        statusColor = '#28a745'; // green
        additionalInfo = 'Please arrive at least 10 minutes early for your appointment.';
        break;
      case 'rejected':
        statusTitle = 'Booking Rejected';
        statusMessage = `Unfortunately, your booking for <strong>${service.name}</strong> has been rejected.`;
        statusColor = '#dc3545'; // red
        additionalInfo = booking.adminMessage 
          ? `Reason: ${booking.adminMessage}` 
          : 'Please contact us if you have any questions.';
        break;
      case 'completed':
        statusTitle = 'Booking Completed';
        statusMessage = `Your booking for <strong>${service.name}</strong> has been marked as completed.`;
        statusColor = '#17a2b8'; // blue
        additionalInfo = 'We hope you enjoyed the service! Please consider leaving a review.';
        break;
      case 'cancelled':
        statusTitle = 'Booking Cancelled';
        statusMessage = `Your booking for <strong>${service.name}</strong> has been cancelled.`;
        statusColor = '#6c757d'; // gray
        additionalInfo = booking.adminMessage 
          ? `Reason: ${booking.adminMessage}` 
          : 'If you did not request this cancellation, please contact us.';
        break;
      default:
        statusTitle = 'Booking Status Updated';
        statusMessage = `The status of your booking for <strong>${service.name}</strong> has been updated to: <strong>${bookingStatus.toUpperCase()}</strong>`;
        statusColor = '#007bff'; // blue
        break;
    }

    logEmailOperation("BOOKING_STATUS_UPDATE_EMAIL_TEMPLATE_START", {
      bookingId: booking.id,
      userId: user?.id,
      status: bookingStatus
    }, true);
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: ${statusColor}; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">${statusTitle}</h1>
        <p>Hello ${user.displayName},</p>
        <p>${statusMessage}</p>

        <div style="background-color: #f7f7f7; border-left: 4px solid ${statusColor}; padding: 15px; margin: 20px 0;">
          <h2 style="color: ${statusColor}; margin-top: 0;">Booking Details</h2>
          <p><strong>Service:</strong> ${service.name}</p>
          <p><strong>Date:</strong> ${formattedDate}</p>
          <p><strong>Time:</strong> ${formattedTime}</p>
          <p><strong>Location:</strong> ${booking.location || service.location || 'To be confirmed'}</p>
          <p><strong>Participants:</strong> ${booking.participants}</p>
          <p><strong>Total Price:</strong> €${parseFloat(booking.totalPrice.toString()).toFixed(2)}</p>
          <p><strong>Booking ID:</strong> #${booking.id}</p>
          <p><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${bookingStatus.toUpperCase()}</span></p>
        </div>

        <div style="background-color: #f0f8ff; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <p><strong>Additional Information:</strong></p>
          <p>${additionalInfo}</p>
        </div>

        <div style="color: #666; font-size: 14px; margin-top: 30px; border-top: 1px solid #eaeaea; padding-top: 20px;">
          <p>If you have any questions about your booking, please contact us.</p>
          <p>Thank you for choosing Urban Culture!</p>
          <p>Urban Culture Team</p>
          <p><small>slmanalmotae@gmail.com</small></p>
        </div>
      </div>
    `;

    logEmailOperation("BOOKING_STATUS_UPDATE_EMAIL_TEMPLATE_SUCCESS", {
      bookingId: booking.id,
      userId: user?.id,
      templateSize: emailHtml.length
    }, true);

    const msg = {
      to: user.email,
      from: VERIFIED_SENDER_EMAIL,
      subject: `${statusTitle} - ${service.name}`,
      text: emailHtml.replace(/<[^>]*>?/gm, ''),
      html: emailHtml,
    };

    logEmailOperation("BOOKING_STATUS_UPDATE_SENDGRID_REQUEST_START", {
      bookingId: booking.id,
      userId: user?.id,
      recipient: user.email,
      sender: VERIFIED_SENDER_EMAIL,
      subject: msg.subject,
      status: bookingStatus
    }, true);

    // Always send email regardless of whether user matches admin email
    try {
      const response = await sendEmail(msg);
      
      logEmailOperation("BOOKING_STATUS_UPDATE_SENDGRID_REQUEST_SUCCESS", {
        bookingId: booking.id,
        userId: user?.id,
        recipient: user.email,
        responseCode: response?.[0]?.statusCode || 'unknown',
        responseMessage: response?.[0]?.statusMessage || 'unknown',
        responseHeaders: JSON.stringify(response?.[0]?.headers || {})
      }, true);
      
      emailSystem.successfulAttempts++;
      emailSystem.totalAttempts++;
      return true;
    } catch (sendGridError: any) {
      // Detailed error logging
      logEmailOperation("BOOKING_STATUS_UPDATE_SENDGRID_REQUEST_FAILED", {
        bookingId: booking.id,
        userId: user?.id,
        recipient: user.email,
        errorCode: sendGridError.code || 'unknown',
        errorMessage: sendGridError.message || 'unknown',
        errorResponse: JSON.stringify(sendGridError.response?.body || {}),
        errorStack: sendGridError.stack || 'unknown',
        timestamp: new Date().toISOString()
      }, false);
      
      throw sendGridError; // Re-throw to be caught by outer catch
    }
  } catch (error: any) {
    logEmailOperation("BOOKING_STATUS_UPDATE_FAILED", {
      bookingId: booking.id,
      userId: user?.id,
      errorMessage: error?.message || 'Unknown error',
      errorType: error?.name || 'Unknown type',
      errorStack: error?.stack || 'No stack trace available',
      timestamp: new Date().toISOString()
    }, false);
    
    console.error('Error sending booking status update email:', error);
    return false;
  }
}

/**
 * Send a booking status update notification to the service provider
 */
export async function sendProviderStatusUpdateEmail(
  provider: User,
  user: User,
  service: Service,
  booking: ServiceBooking
): Promise<boolean> {
  // Log operation start
  logEmailOperation("PROVIDER_STATUS_UPDATE_START", {
    bookingId: booking.id,
    providerId: provider?.id,
    userId: user?.id,
    serviceId: service?.id,
    serviceName: service?.name,
    bookingStatus: booking?.status,
    timestamp: new Date().toISOString()
  }, true);

  if (!isMailgunConfigured) {
    logEmailOperation("PROVIDER_STATUS_UPDATE_FAILED", {
      reason: "Mailgun not configured",
      bookingId: booking.id,
      providerId: provider?.id
    }, false);
    console.warn("Mailgun is not configured. Provider status update email will not be sent.");
    return false;
  }
  
  // Check if Mailgun free tier credits are exceeded
  if (emailSystem.maxCreditsExceeded) {
    logEmailOperation("PROVIDER_STATUS_UPDATE_FAILED", {
      reason: "Mailgun maximum credits exceeded",
      bookingId: booking.id,
      providerId: provider?.id
    }, false);
    console.warn("Mailgun maximum credits exceeded. Provider status update email will not be sent.");
    return false;
  }

  try {
    // Format the date and time for display
    const startDate = new Date(booking.startTime);
    const formattedDate = startDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const formattedTime = startDate.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    // Determine message content based on booking status
    let statusTitle = '';
    let statusMessage = '';
    let actionRequired = '';
    let statusColor = '';

    // Safely handle null/undefined booking status
    const bookingStatus = booking.status || 'pending';

    switch(bookingStatus) {
      case 'cancelled':
        statusTitle = 'Booking Cancelled';
        statusMessage = `A booking for <strong>${service.name}</strong> has been cancelled.`;
        actionRequired = 'No action is required.';
        statusColor = '#6c757d'; // gray
        break;
      case 'completed':
        statusTitle = 'Booking Completed';
        statusMessage = `A booking for <strong>${service.name}</strong> has been marked as completed.`;
        actionRequired = 'No further action is required for this booking.';
        statusColor = '#17a2b8'; // blue
        break;
      default:
        statusTitle = 'Booking Status Update';
        statusMessage = `The status of a booking for <strong>${service.name}</strong> has been updated to: <strong>${bookingStatus.toUpperCase()}</strong>`;
        actionRequired = 'Please check your admin dashboard for more details.';
        statusColor = '#007bff'; // blue
        break;
    }

    logEmailOperation("PROVIDER_STATUS_UPDATE_EMAIL_TEMPLATE_START", {
      bookingId: booking.id,
      providerId: provider?.id,
      status: bookingStatus
    }, true);
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: ${statusColor}; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">${statusTitle}</h1>
        <p>Hello ${provider.displayName},</p>
        <p>${statusMessage}</p>

        <div style="background-color: #f7f7f7; border-left: 4px solid ${statusColor}; padding: 15px; margin: 20px 0;">
          <h2 style="color: ${statusColor}; margin-top: 0;">Booking Details</h2>
          <p><strong>Service:</strong> ${service.name}</p>
          <p><strong>Date:</strong> ${formattedDate}</p>
          <p><strong>Time:</strong> ${formattedTime}</p>
          <p><strong>Location:</strong> ${booking.location || service.location || 'To be confirmed'}</p>
          <p><strong>Participants:</strong> ${booking.participants}</p>
          <p><strong>Customer:</strong> ${user.displayName}</p>
          <p><strong>Booking ID:</strong> #${booking.id}</p>
          <p><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${bookingStatus.toUpperCase()}</span></p>
        </div>

        <div style="background-color: #f0f8ff; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <p><strong>Action Required:</strong></p>
          <p>${actionRequired}</p>
          <p>Visit: <a href="https://urbanculture.app/admin" style="color: #0066cc;">Admin Dashboard</a></p>
        </div>

        <div style="color: #666; font-size: 14px; margin-top: 30px; border-top: 1px solid #eaeaea; padding-top: 20px;">
          <p>Thank you for using our platform to manage your services.</p>
          <p>Urban Culture Team</p>
          <p><small>slmanalmotae@gmail.com</small></p>
        </div>
      </div>
    `;

    logEmailOperation("PROVIDER_STATUS_UPDATE_EMAIL_TEMPLATE_SUCCESS", {
      bookingId: booking.id,
      providerId: provider?.id,
      templateSize: emailHtml.length
    }, true);

    const msg = {
      to: provider.email,
      from: VERIFIED_SENDER_EMAIL,
      subject: `${statusTitle} - ${service.name}`,
      text: emailHtml.replace(/<[^>]*>?/gm, ''),
      html: emailHtml,
    };

    logEmailOperation("PROVIDER_STATUS_UPDATE_SENDGRID_REQUEST_START", {
      bookingId: booking.id,
      providerId: provider?.id,
      recipient: provider.email,
      sender: VERIFIED_SENDER_EMAIL,
      subject: msg.subject,
      status: bookingStatus
    }, true);

    // Always send email regardless of whether provider matches admin email
    try {
      const response = await sendEmail(msg);
      
      logEmailOperation("PROVIDER_STATUS_UPDATE_SENDGRID_REQUEST_SUCCESS", {
        bookingId: booking.id,
        providerId: provider?.id,
        recipient: provider.email,
        responseCode: response?.[0]?.statusCode || 'unknown',
        responseMessage: response?.[0]?.statusMessage || 'unknown',
        responseHeaders: JSON.stringify(response?.[0]?.headers || {})
      }, true);
      
      emailSystem.successfulAttempts++;
      emailSystem.totalAttempts++;
      return true;
    } catch (sendGridError: any) {
      // Detailed error logging
      logEmailOperation("PROVIDER_STATUS_UPDATE_SENDGRID_REQUEST_FAILED", {
        bookingId: booking.id,
        providerId: provider?.id,
        recipient: provider.email,
        errorCode: sendGridError.code || 'unknown',
        errorMessage: sendGridError.message || 'unknown',
        errorResponse: JSON.stringify(sendGridError.response?.body || {}),
        errorStack: sendGridError.stack || 'unknown',
        timestamp: new Date().toISOString()
      }, false);
      
      throw sendGridError; // Re-throw to be caught by outer catch
    }
  } catch (error: any) {
    logEmailOperation("PROVIDER_STATUS_UPDATE_FAILED", {
      bookingId: booking.id,
      providerId: provider?.id,
      errorMessage: error?.message || 'Unknown error',
      errorType: error?.name || 'Unknown type',
      errorStack: error?.stack || 'No stack trace available',
      timestamp: new Date().toISOString()
    }, false);
    
    console.error('Error sending provider status update email:', error);
    return false;
  }
}

/**
 * Send a shipping confirmation email when an order is shipped
 */
export async function sendShippingConfirmationEmail(
  user: User,
  order: Order,
  orderItems: OrderItem[],
  products: Product[]
): Promise<boolean> {
  // Log operation start
  logEmailOperation("SHIPPING_CONFIRMATION_EMAIL_START", {
    orderId: order.id,
    userId: user?.id,
    itemCount: orderItems?.length || 0,
    trackingNumber: order.trackingNumber || 'none',
    timestamp: new Date().toISOString()
  }, true);

  if (!isMailgunConfigured) {
    logEmailOperation("SHIPPING_CONFIRMATION_EMAIL_FAILED", {
      reason: "Mailgun not configured",
      orderId: order.id,
      userId: user?.id
    }, false);
    console.warn("Mailgun is not configured. Shipping confirmation email will not be sent.");
    return false;
  }
  
  // Check if Mailgun free tier credits are exceeded
  if (emailSystem.maxCreditsExceeded) {
    logEmailOperation("SHIPPING_CONFIRMATION_EMAIL_FAILED", {
      reason: "Mailgun maximum credits exceeded",
      orderId: order.id,
      userId: user?.id
    }, false);
    console.warn("Mailgun maximum credits exceeded. Shipping confirmation email will not be sent.");
    return false;
  }

  try {
    console.log("Preparing shipping confirmation email...");
    
    // Check if we have tracking information
    if (!order.trackingNumber) {
      logEmailOperation("SHIPPING_CONFIRMATION_EMAIL_FAILED", {
        reason: "Missing tracking number",
        orderId: order.id,
        userId: user?.id
      }, false);
      console.error("Cannot send shipping confirmation without tracking number");
      return false;
    }
    
    // Get tracking URL (either from order or build default PostNL URL)
    const trackingUrl = order.trackingUrl || 
      `https://postnl.nl/tracktrace/${order.trackingNumber}`;
    
    logEmailOperation("SHIPPING_CONFIRMATION_EMAIL_TEMPLATE_START", {
      orderId: order.id,
      userId: user?.id,
      trackingNumber: order.trackingNumber,
      courier: order.courierName || 'PostNL'
    }, true);
    
    // Email template
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #333;">Your Order Has Shipped</h1>
          <p style="font-size: 16px; color: #666;">Great news! Your package is on its way.</p>
        </div>
        
        <div style="margin-bottom: 30px;">
          <h2 style="color: #333; font-size: 18px;">Order #${order.id}</h2>
          <p style="color: #666; font-size: 14px;">Shipped Date: ${new Date().toLocaleDateString()}</p>
        </div>
        
        <div style="margin-bottom: 30px; background-color: #f5f9ff; padding: 20px; border-radius: 5px; border-left: 4px solid #4285F4;">
          <h3 style="color: #333; font-size: 16px; margin-top: 0;">Tracking Information</h3>
          <p style="color: #666; font-size: 14px; margin-bottom: 5px;">
            <strong>Courier:</strong> ${order.courierName || 'PostNL'}
          </p>
          <p style="color: #666; font-size: 14px; margin-bottom: 5px;">
            <strong>Tracking Number:</strong> ${order.trackingNumber}
          </p>
          <p style="margin-top: 15px;">
            <a href="${trackingUrl}" 
               style="background-color: #4285F4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-size: 14px; display: inline-block;">
              Track Your Package
            </a>
          </p>
        </div>
        
        <div style="margin-bottom: 30px;">
          <h3 style="color: #333; font-size: 16px;">Items Shipped</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="background-color: #f9f9f9;">
              <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Item</th>
              <th style="padding: 10px; text-align: center; border-bottom: 1px solid #ddd;">Quantity</th>
            </tr>
            ${orderItems.map((item, index) => {
              const product = products.find(p => p.id === item.productId);
              
              return `
                <tr style="${index % 2 !== 0 ? 'background-color: #f9f9f9;' : ''}">
                  <td style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">${product?.name || 'Product'}</td>
                  <td style="padding: 10px; text-align: center; border-bottom: 1px solid #ddd;">${item.quantity}</td>
                </tr>
              `;
            }).join('')}
          </table>
        </div>
        
        <div style="margin-bottom: 30px;">
          <h3 style="color: #333; font-size: 16px;">Shipping Address</h3>
          <p style="color: #666; font-size: 14px;">
            ${order.shippingAddress || ''}<br>
            ${order.shippingPostalCode || ''} ${order.shippingCity || ''}<br>
            ${order.shippingCountry || ''}
          </p>
        </div>
        
        <div style="margin-bottom: 30px; background-color: #f9f9f9; padding: 15px; border-radius: 5px;">
          <h3 style="color: #333; font-size: 16px; margin-top: 0;">Delivery Information</h3>
          <p style="color: #666; font-size: 14px;">
            Your order is on its way and should arrive within 3-5 business days.
          </p>
          <p style="color: #666; font-size: 14px;">
            Please make sure someone is available to receive the package at the delivery address.
          </p>
        </div>
        
        <div style="color: #666; font-size: 14px; margin-top: 30px; border-top: 1px solid #eaeaea; padding-top: 20px;">
          <p>Thank you for shopping with us!</p>
          <p>The Urban Culture Team</p>
          <p><small>If you have any questions about your delivery, please reply to this email or contact our customer service team.</small></p>
        </div>
      </div>
    `;

    logEmailOperation("SHIPPING_CONFIRMATION_EMAIL_TEMPLATE_SUCCESS", {
      orderId: order.id,
      userId: user?.id,
      templateSize: emailHtml.length
    }, true);
    
    const msg = {
      to: user.email,
      from: VERIFIED_SENDER_EMAIL,
      subject: `Your Order #${order.id} Has Shipped`,
      text: emailHtml.replace(/<[^>]*>?/gm, ''),
      html: emailHtml,
    };
    
    logEmailOperation("SHIPPING_CONFIRMATION_SENDGRID_REQUEST_START", {
      orderId: order.id,
      userId: user?.id,
      recipient: user.email,
      sender: VERIFIED_SENDER_EMAIL,
      subject: msg.subject
    }, true);
    
    // Send email
    try {
      const response = await sendEmail(msg);
      
      logEmailOperation("SHIPPING_CONFIRMATION_SENDGRID_REQUEST_SUCCESS", {
        orderId: order.id,
        userId: user?.id,
        recipient: user.email,
        responseCode: response?.[0]?.statusCode || 'unknown',
        responseMessage: response?.[0]?.statusMessage || 'unknown',
        responseHeaders: JSON.stringify(response?.[0]?.headers || {})
      }, true);
      
      emailSystem.successfulAttempts++;
      emailSystem.totalAttempts++;
      return true;
    } catch (sendGridError: any) {
      // Detailed error logging
      logEmailOperation("SHIPPING_CONFIRMATION_SENDGRID_REQUEST_FAILED", {
        orderId: order.id,
        userId: user?.id,
        recipient: user.email,
        errorCode: sendGridError.code || 'unknown',
        errorMessage: sendGridError.message || 'unknown',
        errorResponse: JSON.stringify(sendGridError.response?.body || {}),
        errorStack: sendGridError.stack || 'unknown',
        timestamp: new Date().toISOString()
      }, false);
      
      throw sendGridError; // Re-throw to be caught by outer catch
    }
  } catch (error: any) {
    logEmailOperation("SHIPPING_CONFIRMATION_FAILED", {
      orderId: order.id,
      userId: user?.id,
      errorMessage: error?.message || 'Unknown error',
      errorType: error?.name || 'Unknown type',
      errorStack: error?.stack || 'No stack trace available',
      timestamp: new Date().toISOString()
    }, false);
    
    console.error('Error sending shipping confirmation email:', error);
    return false;
  }
}

/**
 * Send a refund confirmation email when an order is refunded/rejected
 */
export async function sendRefundConfirmationEmail(
  user: User,
  order: Order,
  reason: string = 'Seller could not fulfill the order'
): Promise<boolean> {
  try {
    console.log("Preparing refund confirmation email...");
    
    // Email template
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #333;">Refund Confirmation</h1>
          <p style="font-size: 16px; color: #666;">Your order has been refunded</p>
        </div>
        
        <div style="margin-bottom: 30px;">
          <h2 style="color: #333; font-size: 18px;">Order #${order.id}</h2>
          <p style="color: #666; font-size: 14px;">Refund Date: ${new Date().toLocaleDateString()}</p>
        </div>
        
        <div style="margin-bottom: 30px; background-color: #fff9f5; padding: 20px; border-radius: 5px; border-left: 4px solid #ff6b35;">
          <h3 style="color: #333; font-size: 16px; margin-top: 0;">Refund Information</h3>
          <p style="color: #666; font-size: 14px; margin-bottom: 5px;">
            <strong>Amount Refunded:</strong> €${parseFloat(order.totalAmount).toFixed(2)}
          </p>
          <p style="color: #666; font-size: 14px; margin-bottom: 5px;">
            <strong>Refund Reason:</strong> ${order.rejectionReason || reason}
          </p>
        </div>
        
        <div style="margin-bottom: 30px; background-color: #f9f9f9; padding: 15px; border-radius: 5px;">
          <h3 style="color: #333; font-size: 16px; margin-top: 0;">Refund Details</h3>
          <p style="color: #666; font-size: 14px;">
            The refund has been processed and the amount will be credited back to your original payment method.
            Depending on your payment provider, it may take 3-10 business days for the refund to appear in your account.
          </p>
        </div>
        
        <div style="margin-bottom: 30px;">
          <h3 style="color: #333; font-size: 16px;">What's Next?</h3>
          <p style="color: #666; font-size: 14px;">
            We're sorry we couldn't fulfill your order this time. We hope you'll visit our shop again soon!
          </p>
          <p style="margin-top: 15px;">
            <a href="/marketplace" 
               style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-size: 14px; display: inline-block;">
              Browse Our Shop
            </a>
          </p>
        </div>
        
        <div style="color: #666; font-size: 14px; margin-top: 30px; border-top: 1px solid #eaeaea; padding-top: 20px;">
          <p>Thank you for your understanding.</p>
          <p>The Urban Culture Team</p>
          <p><small>If you have any questions about your refund, please reply to this email or contact our customer service team.</small></p>
        </div>
      </div>
    `;
    
    const msg = {
      to: user.email,
      from: VERIFIED_SENDER_EMAIL,
      subject: `Refund Confirmation for Order #${order.id}`,
      text: emailHtml.replace(/<[^>]*>?/gm, ''),
      html: emailHtml,
    };
    
    // Send email
    console.log(`Sending refund confirmation email to ${user.email}...`);
    await sendEmail(msg);
    console.log(`Refund confirmation email sent to ${user.email}`);
    
    return true;
  } catch (error) {
    console.error('Error sending refund confirmation email:', error);
    return false;
  }
}

/**
 * Send an order status update email notification
 * @param user The user to notify
 * @param order The order that was updated
 * @param status The new status of the order
 * @param message Custom message from admin
 * @param adminUser Optional admin user information
 */
export async function sendOrderStatusUpdateEmail(
  user: User,
  order: Order,
  status: string,
  message?: string,
  adminUser?: User
): Promise<boolean> {
  if (!emailSystem.isConfigured || !emailSystem.isEnabled || !emailSystem.hasCredits) {
    console.log('Email system not configured or disabled');
    return false;
  }

  try {
    const userName = user.displayName || 'Customer';
    // Format the date properly without using the format function
    const orderDate = order.createdAt 
      ? new Date(order.createdAt).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }) 
      : 'Unknown date';
    const formattedAmount = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(parseFloat(order.totalAmount));
    const statusDisplay = status.charAt(0).toUpperCase() + status.slice(1);
    
    // Create a status color based on the order status
    let statusColor = '#FFC107'; // yellow - default for pending
    let statusEmoji = '⏳';
    
    switch (status) {
      case 'processing':
        statusColor = '#3F51B5'; // indigo
        statusEmoji = '🔧';
        break;
      case 'shipped':
        statusColor = '#2196F3'; // blue
        statusEmoji = '📦';
        break;
      case 'delivered':
      case 'completed':
        statusColor = '#4CAF50'; // green
        statusEmoji = '✅';
        break;
      case 'cancelled':
      case 'rejected':
        statusColor = '#F44336'; // red
        statusEmoji = '❌';
        break;
    }

    const userEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-bottom: 3px solid #6b21a8;">
          <h2 style="color: #6b21a8; margin: 0;">Order Status Update</h2>
        </div>
        <div style="padding: 20px;">
          <p>Hello ${userName},</p>
          <p>There has been an update to your order <strong>#${order.id}</strong> placed on ${orderDate}.</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Order Amount:</strong> ${formattedAmount}</p>
            <div style="display: inline-block; background-color: ${statusColor}; color: white; padding: 5px 10px; border-radius: 15px; margin-top: 10px;">
              <strong>${statusEmoji} Status:</strong> ${statusDisplay}
            </div>
            ${message ? `<p style="margin: 15px 0 0;"><strong>Message:</strong> ${message}</p>` : ''}
          </div>
          
          <p>To view the full details of your order and its current status, please log in to the Urban Culture app and check the "My Orders" section.</p>
          
          ${status === 'shipped' && order.trackingNumber ? `
          <div style="background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #4CAF50;">
            <p><strong>Tracking Information:</strong></p>
            <p>Tracking Number: ${order.trackingNumber}</p>
            ${order.trackingUrl ? `<p>Track your package: <a href="${order.trackingUrl}" style="color: #4CAF50; text-decoration: underline;" target="_blank">Click here</a></p>` : ''}
          </div>
          ` : ''}
          
          <p>If you have any questions about your order, please contact our support team.</p>
          
          <p style="margin-top: 30px;">Best regards,<br>The Urban Culture Team</p>
        </div>
        <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>&copy; ${new Date().getFullYear()} Urban Culture. All rights reserved.</p>
        </div>
      </div>
    `;

    // Admin notification with more detailed order information
    const adminEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-bottom: 3px solid #6b21a8;">
          <h2 style="color: #6b21a8; margin: 0;">Order Status Update Notification</h2>
        </div>
        <div style="padding: 20px;">
          <p>Hello Admin,</p>
          <p>This is a notification that ${adminUser ? adminUser.displayName : "an administrator"} has updated an order status.</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Order ID:</strong> #${order.id}</p>
            <p style="margin: 5px 0 0;"><strong>Customer:</strong> ${userName} (${user.email})</p>
            <p style="margin: 5px 0 0;"><strong>Amount:</strong> ${formattedAmount}</p>
            <div style="display: inline-block; background-color: ${statusColor}; color: white; padding: 5px 10px; border-radius: 15px; margin-top: 10px;">
              <strong>${statusEmoji} New Status:</strong> ${statusDisplay}
            </div>
            ${message ? `<p style="margin: 15px 0 0;"><strong>Message sent to customer:</strong> ${message}</p>` : ''}
          </div>
          
          <p>A notification email has been sent to the customer.</p>
          
          <p>You can view the full order details in the <a href="${process.env.APP_URL || 'https://dancehealthy.net'}/admin/orders" style="color: #6b21a8; text-decoration: underline;">admin order management panel</a>.</p>
        </div>
        <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>&copy; ${new Date().getFullYear()} Urban Culture. All rights reserved.</p>
        </div>
      </div>
    `;

    // Send email to customer
    const userMsg = {
      to: user.email,
      from: {
        email: VERIFIED_SENDER_EMAIL,
        name: 'Urban Culture'
      },
      subject: `Order #${order.id} Status Update: ${statusDisplay}`,
      html: userEmailHtml
    };

    // Send email to admin
    const adminMsg = {
      to: ADMIN_EMAIL,
      from: {
        email: VERIFIED_SENDER_EMAIL,
        name: 'Urban Culture Admin'
      },
      subject: `Admin Notification: Order #${order.id} Status Updated to ${statusDisplay}`,
      html: adminEmailHtml
    };

    try {
      // Send the email to the user
      await sendEmail(userMsg);
      console.log(`Sent order status update email to ${user.email}`);
      emailSystem.successfulAttempts++;
      emailSystem.totalAttempts++;

      // Only send the admin notification if the user email is different from the admin email
      if (user.email !== VERIFIED_SENDER_EMAIL && user.email !== ADMIN_EMAIL) {
        await sendEmail(adminMsg);
        console.log(`Sent order status update notification to admin ${ADMIN_EMAIL}`);
        emailSystem.successfulAttempts++;
        emailSystem.totalAttempts++;
      } else {
        console.log(`User email is the same as admin email, skipping duplicate notification`);
      }
      
      return true;
    } catch (error: any) {
      console.error('Error sending order status update email:', error);
      emailSystem.failedAttempts++;
      emailSystem.totalAttempts++;
      emailSystem.lastError = error;
      return false;
    }
  } catch (error) {
    console.error('Error preparing order status update email:', error);
    return false;
  }
}

/**
 * Send a test email to verify the email system is working correctly
 * This is used by admins to test the email configuration
 */
/**
 * Generate a PDF order receipt
 */
export async function generatePDFOrderReceipt(
  user: User,
  order: Order,
  orderItems: OrderItem[],
  products: Product[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      // Create a temporary file path
      const tempFilePath = path.join(
        os.tmpdir(),
        `order-receipt-${order.id}-${Date.now()}.pdf`
      );

      // Create a PDF document
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Order Receipt #${order.id}`,
          Author: 'Urban Culture',
          Subject: 'Order Receipt',
        },
      });

      // Pipe the PDF document to a writable stream
      const stream = fs.createWriteStream(tempFilePath);
      doc.pipe(stream);

      // Header
      doc.fontSize(24).font('Helvetica-Bold').text('URBAN CULTURE', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(18).font('Helvetica-Bold').text('ORDER RECEIPT', { align: 'center' });
      doc.moveDown(0.5);

      // Draw a border around the receipt
      doc.lineWidth(2);
      doc.roundedRect(50, 50, doc.page.width - 100, doc.page.height - 100, 10).stroke();

      // Add padding inside the border
      const margin = 70;

      // Order Info
      doc.fontSize(14).font('Helvetica-Bold').text(`Order #${order.id}`, margin, margin + 50);
      doc.fontSize(11).font('Helvetica').text(`Date: ${order.createdAt 
        ? new Date(order.createdAt).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }) 
        : new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })
      }`);
      doc.text(`Customer: ${user.displayName}`);
      doc.text(`Email: ${user.email}`);
      doc.moveDown(1);

      // Order Items Table
      doc.fontSize(12).font('Helvetica-Bold').text('ORDER DETAILS', { underline: true });
      doc.moveDown(0.5);

      // Table headers
      const tableTop = doc.y;
      const tableLeft = margin;
      const colWidths = {
        product: 220,
        quantity: 80,
        price: 80,
        total: 80
      };

      doc.font('Helvetica-Bold')
         .text('Product', tableLeft, tableTop)
         .text('Quantity', tableLeft + colWidths.product, tableTop)
         .text('Price', tableLeft + colWidths.product + colWidths.quantity, tableTop)
         .text('Total', tableLeft + colWidths.product + colWidths.quantity + colWidths.price, tableTop);

      doc.moveDown(0.5);
      let y = doc.y;

      // Draw a line under the header
      doc.moveTo(tableLeft, y - 5)
         .lineTo(tableLeft + colWidths.product + colWidths.quantity + colWidths.price + colWidths.total, y - 5)
         .stroke();

      // Table rows
      let totalAmount = 0;
      
      orderItems.forEach((item, index) => {
        const product = products.find(p => p.id === item.productId);
        if (!product) return;
        
        const itemTotal = parseFloat(item.priceAtPurchase) * item.quantity;
        totalAmount += itemTotal;
        
        doc.font('Helvetica')
           .text(product.name || `Product #${product.id}`, tableLeft, y)
           .text(item.quantity.toString(), tableLeft + colWidths.product, y)
           .text(`€${parseFloat(item.priceAtPurchase).toFixed(2)}`, tableLeft + colWidths.product + colWidths.quantity, y)
           .text(`€${itemTotal.toFixed(2)}`, tableLeft + colWidths.product + colWidths.quantity + colWidths.price, y);
        
        y += 20;
        
        // Add description if it exists
        if (product.description) {
          const descriptionText = (product.description.length > 50) 
            ? product.description.substring(0, 50) + '...' 
            : product.description;
          
          doc.font('Helvetica').fontSize(9)
             .text(descriptionText, tableLeft, y, { width: colWidths.product });
          
          y += 15;
        }
        
        // Add a small line between items
        if (index < orderItems.length - 1) {
          doc.moveTo(tableLeft, y + 5)
             .lineTo(tableLeft + colWidths.product + colWidths.quantity + colWidths.price + colWidths.total, y + 5)
             .stroke(); // Removed opacity as it's not supported in this context
          y += 15;
        }
      });
      
      // Draw a line before the total
      y += 10;
      doc.moveTo(tableLeft, y)
         .lineTo(tableLeft + colWidths.product + colWidths.quantity + colWidths.price + colWidths.total, y)
         .stroke();
      y += 15;

      // Total
      doc.font('Helvetica-Bold')
         .text('Total:', tableLeft + colWidths.product + colWidths.quantity, y)
         .text(`€${totalAmount.toFixed(2)}`, tableLeft + colWidths.product + colWidths.quantity + colWidths.price, y);

      doc.moveDown(2);

      // Payment Information
      doc.fontSize(12).font('Helvetica-Bold').text('PAYMENT INFORMATION', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica')
         .text(`Payment Method: Credit Card`)
         .text(`Payment Status: ${order.status}`)
         .text(`Payment ID: ${order.paymentIntentId || 'N/A'}`);

      // Check if all products are digital
      const allDigitalProducts = orderItems.every(item => {
        const product = products.find(p => p.id === item.productId);
        return product?.isDigital === true;
      });

      // Shipping Information if applicable and not all products are digital
      if (order.shippingAddress && !allDigitalProducts) {
        doc.moveDown(1);
        doc.fontSize(12).font('Helvetica-Bold').text('SHIPPING INFORMATION', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica')
           .text(`Shipping Address: ${order.shippingAddress}`)
           .text(`Tracking Number: ${order.trackingNumber || 'Not yet available'}`);
      }

      // Thank you message
      doc.moveDown(2);
      doc.fontSize(11).font('Helvetica')
         .text('Thank you for your purchase! If you have any questions about your order, please contact our customer service team.', { 
           align: 'center',
           width: doc.page.width - 2 * margin
         });

      // Footer
      doc.fontSize(8).text(`Urban Culture - ${VERIFIED_SENDER_EMAIL}`, margin, doc.page.height - 70, { align: 'center' });
      doc.text('This receipt was generated on ' + new Date().toLocaleString(), { align: 'center' });

      // Finalize the document
      doc.end();

      // Wait for the stream to finish writing
      stream.on('finish', () => {
        // Read the file into a buffer
        try {
          const pdfBuffer = fs.readFileSync(tempFilePath);
          
          // Clean up temporary files
          try {
            fs.unlinkSync(tempFilePath);
          } catch (cleanupError) {
            console.error('Error cleaning up temporary file:', cleanupError);
          }
          
          resolve(pdfBuffer);
        } catch (fileError) {
          console.error(`PDF ERROR: Error processing PDF file ${tempFilePath}:`, fileError);
          reject(fileError);
        }
      });

      stream.on('error', (error) => {
        console.error(`PDF ERROR: Stream error for ${tempFilePath}:`, error);
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Send an order confirmation email with PDF receipt attachment
 */
export async function sendOrderConfirmationEmail(
  user: User,
  order: Order,
  orderItems: OrderItem[],
  products: Product[]
): Promise<boolean> {
  console.log(`Starting order confirmation email send process for order ${order.id}`);
  if (!isMailgunConfigured) {
    console.warn("Mailgun is not configured. Order confirmation email will not be sent.");
    return false;
  }
  
  if (!user?.email || !order?.id) {
    console.error("Missing required data for order email:", {
      hasUserEmail: !!user?.email,
      hasOrderId: !!order?.id
    });
    return false;
  }

  try {
    console.log("Generating PDF order receipt...");
    // Generate the PDF order receipt
    const pdfBuffer = await generatePDFOrderReceipt(user, order, orderItems, products);
    console.log("PDF generation successful");

    // Format the date for display
    const orderDate = order.createdAt ? new Date(order.createdAt) : new Date();
    const formattedDate = orderDate.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Calculate total amount
    let totalAmount = 0;
    orderItems.forEach(item => {
      totalAmount += parseFloat(item.priceAtPurchase) * item.quantity;
    });

    // Create HTML for order items
    let itemsHtml = '';
    orderItems.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      if (!product) return;
      
      const itemTotal = parseFloat(item.priceAtPurchase) * item.quantity;
      
      itemsHtml += `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${product.name || `Product #${product.id}`}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">€${parseFloat(item.priceAtPurchase).toFixed(2)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">€${itemTotal.toFixed(2)}</td>
        </tr>
      `;
    });

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">Order Confirmation</h1>
        <p>Hello ${user.displayName},</p>
        <p>Thank you for your order! Your purchase has been confirmed and processed successfully. A receipt is attached to this email as a PDF document.</p>

        <div style="background-color: #f7f7f7; border-left: 4px solid #4a90e2; padding: 15px; margin: 20px 0;">
          <h2 style="color: #4a90e2; margin-top: 0;">Order Summary</h2>
          <p><strong>Order Number:</strong> #${order.id}</p>
          <p><strong>Order Date:</strong> ${formattedDate}</p>
          <p><strong>Payment Status:</strong> ${order.status}</p>
          <p><strong>Total Amount:</strong> €${totalAmount.toFixed(2)}</p>
        </div>

        <h3 style="margin-top: 30px;">Order Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th style="padding: 10px; text-align: left;">Product</th>
              <th style="padding: 10px; text-align: center;">Quantity</th>
              <th style="padding: 10px; text-align: right;">Price</th>
              <th style="padding: 10px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
            <tr>
              <td colspan="3" style="padding: 10px; text-align: right; font-weight: bold;">Total:</td>
              <td style="padding: 10px; text-align: right; font-weight: bold;">€${totalAmount.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        ${order.shippingAddress && !(products.every(p => p.isDigital)) ? `
        <div style="margin: 30px 0; padding: 15px; background-color: #f9f9f9; border-radius: 5px;">
          <h3 style="margin-top: 0;">Shipping Information</h3>
          <p><strong>Shipping Address:</strong> ${order.shippingAddress}</p>
          <p><strong>Tracking Number:</strong> ${order.trackingNumber || 'Not yet available'}</p>
        </div>
        ` : 
        (products.every(p => p.isDigital)) ? `
        <div style="margin: 30px 0; padding: 15px; background-color: #f0f7ff; border-radius: 5px;">
          <h3 style="margin-top: 0;">Digital Product</h3>
          <p>Your purchase contains digital items that will be available for download in your account.</p>
        </div>
        ` : ''}

        <div style="color: #666; font-size: 14px; margin-top: 30px; border-top: 1px solid #eaeaea; padding-top: 20px;">
          <p>If you have any questions or need assistance with your order, please contact our customer service team.</p>
          <p>Thank you for shopping with Urban Culture!</p>
          <p>Urban Culture Team</p>
        </div>
      </div>
    `;

    console.log("Email HTML content prepared");

    // Email to the user
    const userMsg = {
      to: user.email,
      from: VERIFIED_SENDER_EMAIL, // Must be the verified sender in Mailgun
      subject: `Order Confirmation #${order.id} - Urban Culture`,
      html: emailHtml,
      attachments: [
        {
          content: pdfBuffer.toString('base64'),
          filename: `Order-Receipt-${order.id}.pdf`,
          type: 'application/pdf',
          disposition: 'attachment',
        },
      ],
    };

    // Email to the admin (using the same verified sender for both from and to)
    const adminEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">New Order Received</h1>
        <p>A new order has been placed on the Urban Culture platform.</p>

        <div style="background-color: #f7f7f7; border-left: 4px solid #4a90e2; padding: 15px; margin: 20px 0;">
          <h2 style="color: #4a90e2; margin-top: 0;">Order Details</h2>
          <p><strong>Order Number:</strong> #${order.id}</p>
          <p><strong>Order Date:</strong> ${formattedDate}</p>
          <p><strong>Customer:</strong> ${user.displayName} (${user.email})</p>
          <p><strong>Total Amount:</strong> €${totalAmount.toFixed(2)}</p>
          <p><strong>Items:</strong> ${orderItems.length}</p>
        </div>

        <div style="color: #666; font-size: 14px; margin-top: 30px; border-top: 1px solid #eaeaea; padding-top: 20px;">
          <p>This is an automated notification from your Urban Culture platform.</p>
        </div>
      </div>
    `;

    const adminMsg = {
      to: VERIFIED_SENDER_EMAIL, // Important: Must be same as 'from' in Mailgun
      from: VERIFIED_SENDER_EMAIL, // Must be the verified sender in Mailgun
      subject: `New Order #${order.id} - Urban Culture Shop`,
      text: adminEmailHtml.replace(/<[^>]*>?/gm, ''),
      html: adminEmailHtml,
      attachments: [
        {
          content: pdfBuffer.toString('base64'),
          filename: `Order-Receipt-${order.id}.pdf`,
          type: 'application/pdf',
          disposition: 'attachment',
        },
      ],
    };

    // Send the email to the user
    try {
      console.log(`Attempting to send order confirmation email to ${user.email} with Mailgun...`);
      console.log(`Using verified sender: ${VERIFIED_SENDER_EMAIL}`);
      console.log(`Email subject: ${userMsg.subject}`);
      
      await sendEmail(userMsg);
      console.log(`SUCCESS: Sent order confirmation email to ${user.email}`);
    } catch (userEmailError) {
      console.error("Error sending user confirmation email:", userEmailError);
      
      const err = userEmailError as any;
      // Enhanced error logging with detailed inspection
      console.error("Email error details:");
      if (err.response) {
        console.error(`Status code: ${err.response.statusCode}`);
        console.error(`Body: ${JSON.stringify(err.response.body)}`);
      }
      
      // Check for common Mailgun errors
      if (err.response?.body?.errors?.[0]?.message?.includes('sender identity')) {
        console.error("Mailgun sender identity error detected. Make sure the 'from' email address matches your verified sender in Mailgun.");
        console.error(`Current from email: ${userMsg.from}, Verified sender: ${VERIFIED_SENDER_EMAIL}`);
      } else if (err.code === 'ECONNREFUSED') {
        console.error("Connection refused. Check network connectivity and firewall settings.");
      } else if (err.code === 'ETIMEDOUT') {
        console.error("Connection timed out. Mailgun may be experiencing issues.");
      }
      
      throw err; // Re-throw to be caught by outer try/catch
    }

    // Only send the admin notification if the user email is different from the admin email
    if (user.email !== VERIFIED_SENDER_EMAIL) {
      try {
        console.log(`Attempting to send order notification email to admin (${VERIFIED_SENDER_EMAIL})...`);
        console.log(`Admin email from: ${adminMsg.from}, to: ${adminMsg.to}`);
        console.log(`Admin email subject: ${adminMsg.subject}`);
        
        await sendEmail(adminMsg);
        console.log(`SUCCESS: Sent order notification email to admin (${VERIFIED_SENDER_EMAIL})`);
      } catch (adminEmailError) {
        const err = adminEmailError as any;
        console.error("Error sending admin notification email:", err);
        
        // Enhanced error logging with detailed inspection
        console.error("Admin email error details:");
        if (err.response) {
          console.error(`Status code: ${err.response.statusCode}`);
          console.error(`Body: ${JSON.stringify(err.response.body)}`);
        } else {
          console.error(`Error type: ${typeof err}`);
          console.error(`Error message: ${err.message || 'No message'}`);
        }
        
        // Continue without failing the whole process if admin email fails
      }
    } else {
      console.log(`User email (${user.email}) is the same as admin email (${VERIFIED_SENDER_EMAIL}), skipping duplicate notification`);
    }
    
    return true;
  } catch (error) {
    console.error('Error sending order confirmation email:', error);
    return false;
  }
}

export async function sendTestEmail(
  recipientEmail: string,
  testType: 'booking' | 'ticket' | 'plain' | 'order' = 'plain'
): Promise<{success: boolean, message: string}> {
  if (!isMailgunConfigured) {
    console.warn("Mailgun is not configured. Test email will not be sent.");
    return {
      success: false,
      message: "Email services not configured - missing Mailgun API key"
    };
  }

  console.log(`Attempting to send test email to ${recipientEmail} (type: ${testType})`);

  try {
    // Different test email types
    if (testType === 'booking') {
      // Create mock data for a booking email test
      const mockUser: User = {
        id: 0,
        email: recipientEmail,
        displayName: "Test User",
        role: "user",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockService: Service = {
        id: 456,
        providerId: 101,
        name: "Test Service",
        description: "This is a test service description used for email testing.",
        category: "TEST",
        type: "TEST",
        price: "50",
        duration: 60,
        images: [],
        isActive: true,
        isVerified: true,
        maxParticipants: 1,
        location: "Test Location",
        skillLevel: "Beginner",
        isRemote: false,
        requirements: "None",
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockBooking: ServiceBooking = {
        id: 123, // Changed from 0 to a valid ID
        serviceId: 456,
        userId: 789,
        providerId: 101,
        startTime: new Date(Date.now() + 86400000), // Tomorrow
        endTime: new Date(Date.now() + 86400000 + 3600000), // Tomorrow + 1 hour
        status: "PAYMENT_SUCCESSFUL",
        totalPrice: "50",
        participants: 1,
        location: "Test Location",
        paymentIntentId: "test_payment_intent_id",
        isPaid: true,
        isRefunded: false,
        emailSent: false,
        message: "Test booking message",
        adminMessage: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await sendBookingConfirmationEmail(mockUser, mockService, mockBooking);

      if (result) {
        return {
          success: true,
          message: `Test booking confirmation email sent successfully to ${recipientEmail}`
        };
      } else {
        return {
          success: false,
          message: "Failed to send test booking confirmation email"
        };
      }
    } else if (testType === 'ticket') {
      // Create mock data for a ticket email test
      const mockUser: User = {
        id: 0,
        email: recipientEmail,
        displayName: "Test User",
        role: "user",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockEvent: Event = {
        id: 0,
        title: "Test Event",
        description: "This is a test event description used for email testing.",
        date: new Date(Date.now() + 172800000), // Two days from now
        location: "Test Venue",
        status: "active",
        category: "TEST",
        createdAt: new Date(),
        updatedAt: new Date(),
        organizerId: 0
      };

      // Generate a simple QR code for the test
      const qrCodeData = await QRCode.toDataURL('test-ticket-123');

      const result = await sendTicketConfirmationEmail(mockUser, mockEvent, 0, qrCodeData);

      if (result) {
        return {
          success: true,
          message: `Test ticket confirmation email sent successfully to ${recipientEmail}`
        };
      } else {
        return {
          success: false,
          message: "Failed to send test ticket confirmation email"
        };
      }
    } else if (testType === 'order') {
      // Create mock data for an order email test
      const mockUser: User = {
        id: 0,
        email: recipientEmail,
        displayName: "Test User",
        role: "user",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
        password: null,
        bio: null,
        profilePicture: null,
        artType: null,
        organizationName: null,
        kvkNumber: null,
        btwNumber: null,
        kvkVerificationStatus: null,
        kvkVerifiedAt: null,
        kvkVerificationFailReason: null,
        isVerified: false,
        isApproved: false,
        location: null,
        stripeCustomerId: null,
        firebaseUid: null
      };

      const mockOrder: Order = {
        id: 123,
        buyerId: 0,
        totalAmount: "99.99",
        status: "completed",
        paymentIntentId: "test_payment_intent_id",
        shippingAddress: "123 Test Street, Test City, 12345",
        trackingNumber: "TEST123456789",
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockProduct1: Product = {
        id: 1,
        name: "Test Product 1",
        description: "This is a test product for email testing.",
        price: "49.99",
        category: "test",
        images: [],
        stock: 10,
        sellerId: 1,
        isDigital: false,
        digitalContentUrl: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockProduct2: Product = {
        id: 2,
        name: "Test Product 2",
        description: "Another test product for email testing.",
        price: "50.00",
        category: "test",
        images: [],
        stock: 5,
        sellerId: 1,
        isDigital: false,
        digitalContentUrl: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockOrderItems: OrderItem[] = [
        {
          id: 1,
          orderId: 123,
          productId: 1,
          quantity: 1,
          priceAtPurchase: "49.99",
          createdAt: new Date()
        },
        {
          id: 2,
          orderId: 123,
          productId: 2,
          quantity: 1,
          priceAtPurchase: "50.00",
          createdAt: new Date()
        }
      ];

      const result = await sendOrderConfirmationEmail(mockUser, mockOrder, mockOrderItems, [mockProduct1, mockProduct2]);

      if (result) {
        return {
          success: true,
          message: `Test order confirmation email sent successfully to ${recipientEmail}`
        };
      } else {
        return {
          success: false,
          message: "Failed to send test order confirmation email"
        };
      }
    } else {
      // Simple plain text/HTML test email
      const msg = {
        to: recipientEmail,
        from: VERIFIED_SENDER_EMAIL,
        subject: "Urban Culture - Email System Test",
        text: "This is a test email to verify that the email system is working correctly.",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">Email System Test</h1>
            <p>This is a test email to verify that the email system is working correctly.</p>

            <div style="background-color: #f7f7f7; border-left: 4px solid #4a90e2; padding: 15px; margin: 20px 0;">
              <h2 style="color: #4a90e2; margin-top: 0;">System Details</h2>
              <p><strong>Mailgun Status:</strong> Connected</p>
              <p><strong>Verified Sender:</strong> ${VERIFIED_SENDER_EMAIL}</p>
              <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            </div>

            <div style="color: #666; font-size: 14px; margin-top: 30px; border-top: 1px solid #eaeaea; padding-top: 20px;">
              <p>If you received this email, your email system is working correctly!</p>
              <p>Urban Culture Team</p>
            </div>
          </div>
        `,
      };

      const response = await sendEmail(msg);
      console.log("Test email response:", response[0].statusCode);

      return {
        success: true,
        message: `Test email sent successfully to ${recipientEmail} (Status code: ${response[0].statusCode})`
      };
    }
  } catch (error) {
    console.error('Error sending test email:', error);
    let errorMessage = "Unknown error";

    if (error && typeof error === 'object') {
      if ('response' in error) {
        const typedError = error as { response: { body: any } };
        errorMessage = JSON.stringify(typedError.response.body);
      } else if ('message' in error) {
        errorMessage = (error as { message: string }).message;
      }
    }

    return {
      success: false,
      message: `Failed to send test email: ${errorMessage}`
    };
  }
}
export async function sendAdminSecurityEmail(to: string, subject: string, text: string, html: string): Promise<void> {
  await sendEmail({
    to,
    from: `Urban Culture Hub Security <${VERIFIED_SENDER_EMAIL}>`,
    subject,
    text,
    html,
  });
}
