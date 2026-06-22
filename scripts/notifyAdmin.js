require('dotenv').config();

const nodemailer = require('nodemailer');
const twilio = require('twilio');

const Settings = require('../models/Settings');
const AdminNotification = require('../models/AdminNotification');

function safeString(v) {
  if (v === null || v === undefined) return '';
  return String(v);
}

function buildOrderNotificationPayload({ order, products = [], lowStockItems = [] }) {
  return {
    orderNumber: order?.orderNumber || '',
    customerName: safeString(order?.customer?.name),
    phoneNumber: safeString(order?.customer?.phone),
    totalAmount: typeof order?.totalAmount === 'number' ? order.totalAmount : Number(order?.totalAmount || 0),
    orderStatus: safeString(order?.status),
    products,
    lowStockItems
  };
}

function formatProductsForLog(products) {
  if (!Array.isArray(products) || products.length === 0) return '';
  try {
    return products.map(p => `${p?.name || ''} (SKU: ${p?.sku || ''})`).join(', ');
  } catch {
    return '';
  }
}


async function getAdminTargets() {
  const settings = await Settings.findOne();

  return {
    email: settings?.notificationEmail || settings?.email || '',
    whatsappPhone: settings?.notificationWhatsAppPhone || settings?.whatsapp || ''
  };
}

function createEmailTransport() {
  // Configure via SMTP.
  // Example env:
  // SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  if (!host || !user || !pass || !from) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

async function sendEmailNotification({ to, subject, text }) {
  const transport = createEmailTransport();
  if (!transport) {
    throw new Error('Email transport not configured (missing SMTP_* env vars).');
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text
  });
}

function createTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;

  if (!sid || !token) return null;
  return twilio(sid, token);
}

function whatsappE164FromDigits(phoneDigits) {
  // Expect digits like 919879... (no +)
  const digits = String(phoneDigits || '').replace(/\D/g, '');
  if (!digits) return '';

  // Assuming Indian numbers if starting with 91; otherwise default country code from env.
  const countryCode = process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91';

  if (digits.startsWith(countryCode)) return `+${digits}`;
  return `+${countryCode}${digits}`;
}

async function sendWhatsAppNotification({ toDigits, body }) {
  const client = createTwilioClient();
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM; // e.g., +1415....

  if (!client || !fromNumber) {
    throw new Error('WhatsApp transport not configured (missing TWILIO_* env vars).');
  }

  const to = whatsappE164FromDigits(toDigits);
  if (!to) throw new Error('Invalid WhatsApp destination number');

  // Twilio WhatsApp message API
  await client.messages.create({
    from: fromNumber,
    to,
    body
  });
}

async function notifyAdmin({ type, order, products = [], lowStockItems = [] }) {
  // Create a notification record first, and update it regardless of email/whatsapp outcomes.
  const payload = buildOrderNotificationPayload({ order, products, lowStockItems });
  const notification = await AdminNotification.create({
    type,
    orderId: order?._id || null,
    payload
  });

  const { email, whatsappPhone } = await getAdminTargets();

  const subjectMap = {
    ORDER_CREATED: 'New Order Created',
    ORDER_STATUS_UPDATED: 'Order Status Updated',
    LOW_STOCK_ALERT: 'Low Stock Alert'
  };

  const subject = subjectMap[type] || 'Admin Notification';

  const textLines = [
    `Type: ${type}`,
    `Order ID: ${payload.orderNumber || order?._id || ''}`,
    `Customer Name: ${payload.customerName}`,
    `Phone Number: ${payload.phoneNumber}`,
    `Total Amount: ₹${payload.totalAmount}`,
    `Order Status: ${payload.orderStatus}`
  ];

  if (type === 'LOW_STOCK_ALERT') {
    textLines.push('');
    textLines.push('Low stock items:');
    if (payload.lowStockItems?.length) {
      for (const it of payload.lowStockItems) {
        textLines.push(`- ${it.name} (SKU: ${it.sku}) | Stock: ${it.stock}`);
      }
    } else {
      textLines.push('(none)');
    }
  }

  const text = textLines.join('\n');

  // Email attempt
  try {
    if (!email) throw new Error('notificationEmail is not configured.');
    await sendEmailNotification({ to: email, subject, text });
    notification.email.status = 'sent';
    notification.email.failureReason = '';
  } catch (err) {
    notification.email.status = 'failed';
    notification.email.failureReason = err?.message || String(err);
    // log but never throw
    console.error('[AdminNotification] Email failed:', err);
  }

  // WhatsApp attempt
  try {
    if (!whatsappPhone) throw new Error('notificationWhatsAppPhone is not configured.');
    await sendWhatsAppNotification({ toDigits: whatsappPhone, body: text });
    notification.whatsapp.status = 'sent';
    notification.whatsapp.failureReason = '';
  } catch (err) {
    notification.whatsapp.status = 'failed';
    notification.whatsapp.failureReason = err?.message || String(err);
    console.error('[AdminNotification] WhatsApp failed:', err);
  }

  // overallStatus
  if (notification.email.status === 'sent' && notification.whatsapp.status === 'sent') {
    notification.overallStatus = 'sent';
  } else if (notification.email.status === 'failed' && notification.whatsapp.status === 'failed') {
    notification.overallStatus = 'failed';
  } else {
    notification.overallStatus = 'partial';
  }

  await notification.save();
  return notification;
}

module.exports = {
  notifyAdmin
};

