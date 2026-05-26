import QRCode from 'qrcode';
import { storage } from './storage';
import { Event, InsertTicket, User } from '@shared/schema';
import { sendTicketConfirmationEmail } from './email';

interface TicketOptions {
  userId: number;
  eventId: number;
  paymentIntentId: string;
  purchaseAmount: number;
  ticketQuantity: number;
  ticketNumber?: string;
  isPaid?: boolean;
  isValid?: boolean;
}

export async function generateQRCode(ticketId: number, additionalData?: Record<string, any>): Promise<string> {
  const qrData = {
    type: 'event_ticket',
    ticketId,
    timestamp: Date.now(),
    ...additionalData
  };
  
  // Convert to a more compact JSON format without whitespace
  const qrContent = JSON.stringify(qrData);
  
  // Use smaller margin and more error correction for better scanning reliability
  return QRCode.toDataURL(qrContent, {
    errorCorrectionLevel: 'H', 
    margin: 1,
    width: 300, // Increase size for better readability
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  });
}

export async function createTicketWithQR(options: TicketOptions): Promise<any> {
  const { 
    userId, 
    eventId, 
    paymentIntentId, 
    purchaseAmount, 
    ticketQuantity,
    ticketNumber,
    isPaid,
    isValid
  } = options;
  
  // Get user and event details for the email
  const user = await storage.getUser(userId);
  const event = await storage.getEvent(eventId);
  
  if (!user || !event) {
    throw new Error('User or event not found');
  }
  
  // Generate ticket number if not provided
  const generatedTicketNumber = ticketNumber || 
    `TKT-${event.title.slice(0,3).toUpperCase()}-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.random().toString().slice(2,6)}`;
  
  // Get event ticket type (if available) to determine ticket type
  let ticketType = 'standard';
  try {
    const ticketTypes = await storage.getEventTicketTypesByEvent(eventId);
    if (ticketTypes && ticketTypes.length > 0) {
      // Find a matching ticket type based on price
      const matchingTicketType = ticketTypes.find(tt => 
        Number(tt.price) === purchaseAmount / ticketQuantity
      );
      if (matchingTicketType) {
        ticketType = matchingTicketType.name;
      }
    }
  } catch (error) {
    console.warn('Could not determine ticket type from event ticket types', error);
  }
  
  // Generate a temporary ticket ID for QR code generation
  const tempTicketId = Date.now(); // Using timestamp as temporary ID
  
  // Generate QR code first with basic data
  const tempQrData = {
    type: 'event_ticket',
    tempId: tempTicketId,
    timestamp: Date.now(),
    ticketNumber: generatedTicketNumber,
    eventId: eventId
  };
  
  // Generate a temporary QR code that will be updated later
  const initialQrCode = await QRCode.toDataURL(JSON.stringify(tempQrData), {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 300 // Increase size for better readability
  });
  
  // Create ticket record with the temporary QR code
  const ticketData: InsertTicket = {
    eventId,
    userId,
    paymentIntentId,
    qrCode: initialQrCode, // Use the temporary QR code initially
    purchaseAmount,
    ticketQuantity,
    ticketNumber: generatedTicketNumber,
    type: ticketType,
    isValid: isValid !== undefined ? isValid : true,
  };
  
  console.log(`Creating ticket with initial QR code for user ${userId}, event ${eventId}`);
  let ticket;
  try {
    ticket = await storage.createTicket(ticketData);
  } catch (error: any) {
    // Handle unique constraint violation (duplicate payment intent)
    if (error.code === '23505' || error.message?.includes('unique constraint') || error.message?.includes('duplicate key')) {
      console.log(`Ticket already exists for payment ${paymentIntentId}, fetching existing ticket`);
      const existingTicket = await storage.getTicketByPaymentIntentId(paymentIntentId);
      if (existingTicket) {
        return existingTicket;
      }
    }
    throw error;
  }
  
  // Generate the real QR code with the actual ticket ID
  const finalQrCode = await generateQRCode(ticket.id, {
    eventId: eventId,
    ticketNumber: generatedTicketNumber,
    type: ticketType,
    event: {
      title: event.title,
      date: event.date
    },
    user: {
      name: user.displayName,
      email: user.email
    }
  });
  
  // Prepare update data
  const updateData: Partial<any> = { 
    qrCode: finalQrCode,
    isUsed: false,
    scanCount: 0,
  };
  
  // Add optional fields if provided
  if (isPaid !== undefined) {
    updateData.isPaid = isPaid;
  }
  
  // Update ticket with the real QR code and other fields
  await storage.updateTicket(ticket.id, updateData);
  console.log(`Updated ticket ${ticket.id} with final QR code`);
  
  try {
    // Send confirmation email with PDF ticket attachment
    console.log(`Sending email confirmation for ticket ${ticket.id} to ${user.email}`);
    const emailSent = await sendTicketConfirmationEmail(user, event, ticket.id, finalQrCode);
    
    // Mark email status
    await storage.updateTicket(ticket.id, { 
      emailSent,
      pdfUrl: `ticket_${ticket.id}_${generatedTicketNumber}.pdf` // Reference to the PDF file
    });
    
    if (emailSent) {
      console.log(`Ticket confirmation email sent successfully for ticket ID: ${ticket.id}`);
    } else {
      console.warn(`Failed to send ticket confirmation email for ticket ID: ${ticket.id}`);
    }
  } catch (error) {
    console.error(`Error processing ticket email for ticket ID: ${ticket.id}`, error);
    // Still keep the ticket with QR code, but mark email as not sent
    await storage.updateTicket(ticket.id, { emailSent: false });
  }
  
  return ticket;
}

export async function validateTicket(qrCode: string, scanerInfo?: Record<string, any>): Promise<{
  valid: boolean;
  message: string;
  ticketId?: number;
  ticketNumber?: string;
  alreadyUsed?: boolean;
  ticketInfo?: any;
  scanCount?: number;
  debug?: any;
}> {
  // Declare debugInfo outside try block so it's available to the catch block
  let debugInfo: any = { 
    qrFormat: null,
    parseAttempted: false,
    parseResult: null
  };
  
  try {
    // Parse QR code data if it's JSON
    let ticketId: number | null = null;
    let parsedQrData: any = null;
    
    // Try to parse as JSON
    if (typeof qrCode === 'string') {
      debugInfo.originalLength = qrCode.length;
      
      // Check if it's a data URL
      if (qrCode.startsWith('data:image/')) {
        debugInfo.qrFormat = 'data-url';
        // Data URLs can contain the JSON in their data after being scanned
        // Look for JSON that might be embedded in the data URL
        const jsonMatch = qrCode.match(/{.*}/);
        if (jsonMatch) {
          try {
            parsedQrData = JSON.parse(jsonMatch[0]);
            debugInfo.parseAttempted = true;
            debugInfo.parseResult = 'success-from-data-url';
            debugInfo.extractedJsonFromDataUrl = true;
            
            if (parsedQrData.ticketId) {
              ticketId = parsedQrData.ticketId;
              debugInfo.extractedId = ticketId;
            } else if (parsedQrData.id) {
              ticketId = parsedQrData.id;
              debugInfo.extractedId = ticketId;
            }
          } catch (parseError: any) {
            debugInfo.parseResult = 'failed-data-url-extraction';
            debugInfo.parseError = parseError?.message || 'Unknown parsing error';
          }
        }
      } else {
        // Regular string, try to parse as JSON
        try {
          parsedQrData = JSON.parse(qrCode);
          debugInfo.parseAttempted = true;
          debugInfo.parseResult = 'success';
          debugInfo.qrFormat = 'json';
          
          // If we have a ticket ID in the JSON data, use it directly
          if (parsedQrData.ticketId) {
            ticketId = parsedQrData.ticketId;
            debugInfo.extractedId = ticketId;
          } else if (parsedQrData.id) {
            ticketId = parsedQrData.id;
            debugInfo.extractedId = ticketId;
          }
        } catch (parseError: any) {
          debugInfo.parseResult = 'failed';
          debugInfo.parseError = parseError?.message || 'Unknown parsing error';
          debugInfo.qrFormat = 'plain-text';
          // Not valid JSON, continue to next approach
        }
      }
    } else {
      debugInfo.qrFormat = 'unknown-type';
      debugInfo.qrType = typeof qrCode;
    }
    
    // Get ticket either by ID or QR code
    let ticket;
    if (ticketId) {
      // Search by ID if we extracted one from JSON
      ticket = await storage.getTicket(ticketId);
      debugInfo.lookupMethod = 'by-id';
    } else {
      // Otherwise search by the raw QR code string
      ticket = await storage.validateTicket(qrCode);
      debugInfo.lookupMethod = 'by-qrcode';
    }
    
    if (!ticket) {
      return {
        valid: false,
        message: 'Invalid ticket. Ticket not found in the system.',
        debug: debugInfo
      };
    }
    
    // Safely access properties with nullish coalescing
    ticketId = ticket.id ?? 0;
    const eventId = ticket.eventId ?? 0;
    const ticketNumber = ticket.ticketNumber ?? '';
    
    // Check if ticket is valid (admin may have marked it invalid)
    if (ticket.isValid === false) {
      return {
        valid: false,
        message: 'This ticket has been marked as invalid by an administrator',
        ticketId,
        ticketNumber,
        ticketInfo: {
          type: ticket.type,
          purchaseAmount: ticket.purchaseAmount,
          ticketQuantity: ticket.ticketQuantity
        },
        debug: {
          ...debugInfo,
          invalidReason: 'marked_invalid_by_admin',
          ticketFound: true
        }
      };
    }
    
    // Get current scan count
    const scanCount = ticket.scanCount ? ticket.scanCount + 1 : 1;
    
    // If the ticket has been used before
    if (ticket.isUsed) {
      // Update the scan count but don't allow entry
      await storage.updateTicket(ticketId, { 
        scanCount,
        lastScanned: new Date()
      });
      
      return {
        valid: false,
        message: 'Ticket has already been used',
        ticketId,
        ticketNumber,
        alreadyUsed: true,
        scanCount,
        ticketInfo: {
          type: ticket.type,
          purchaseAmount: ticket.purchaseAmount,
          ticketQuantity: ticket.ticketQuantity,
          userId: ticket.userId
        },
        debug: {
          ...debugInfo,
          invalidReason: 'already_used',
          ticketFound: true,
          lastScanned: ticket.lastScanned,
          checkInTime: ticket.checkInTime
        }
      };
    }
    
    // Check if event date is valid
    const event = await storage.getEvent(eventId);
    if (!event) {
      return {
        valid: false,
        message: 'Event not found',
        ticketId,
        ticketNumber,
        debug: {
          ...debugInfo,
          invalidReason: 'event_not_found',
          ticketFound: true,
          eventId
        }
      };
    }
    
    const eventDate = new Date(event.date);
    if (eventDate < new Date()) {
      return {
        valid: false,
        message: 'Event has already passed',
        ticketId,
        ticketNumber,
        debug: {
          ...debugInfo,
          invalidReason: 'event_expired',
          ticketFound: true,
          eventId,
          eventDate: eventDate.toISOString(),
          currentDate: new Date().toISOString()
        }
      };
    }
    
    // All checks passed, mark ticket as used and update scan information
    const updateData: any = { 
      isUsed: true,
      scanCount,
      lastScanned: new Date(),
      checkInTime: new Date()
    };
    
    // Include scanner info if provided
    if (scanerInfo) {
      // Store scanner info in the notes field as a JSON string
      updateData.notes = JSON.stringify({
        scanInfo: scanerInfo,
        timestamp: new Date().toISOString()
      });
    }
    
    await storage.updateTicket(ticketId, updateData);
    
    // Get user info if available
    let userInfo = {};
    if (ticket.userId) {
      try {
        const user = await storage.getUser(ticket.userId);
        if (user) {
          userInfo = {
            name: user.displayName,
            email: user.email
          };
        }
      } catch (error) {
        console.error('Error fetching user info for ticket:', error);
      }
    }
    
    return {
      valid: true,
      message: 'Ticket validated successfully',
      ticketId,
      ticketNumber,
      scanCount,
      ticketInfo: {
        type: ticket.type,
        purchaseAmount: ticket.purchaseAmount,
        ticketQuantity: ticket.ticketQuantity,
        eventTitle: event.title,
        eventDate: eventDate,
        user: userInfo
      },
      debug: {
        ...debugInfo,
        ticketFound: true,
        eventId,
        validReason: 'valid_ticket',
        scanHistory: {
          previousScans: ticket.scanCount || 0,
          lastScanned: ticket.lastScanned,
          checkInTime: ticket.checkInTime
        },
        scannerData: scanerInfo ? 'present' : 'not_provided'
      }
    };
  } catch (error: any) {
    console.error('Error validating ticket:', error);
    return {
      valid: false,
      message: 'Error validating ticket',
      debug: {
        errorType: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        parseAttempted: debugInfo?.parseAttempted || false,
        qrFormat: debugInfo?.qrFormat || 'unknown',
        ticketLookupAttempted: !!debugInfo?.lookupMethod,
        scannerInfo: !!scanerInfo
      }
    };
  }
}