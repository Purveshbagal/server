const fs = require('fs');
const path = require('path');
const Invoice = require('../models/Invoice');
const Order = require('../models/Order');

async function generateInvoicePdf(invoice, order) {
  // Try to generate basic PDF if pdfkit is installed; otherwise skip
  try {
    const PDFDocument = require('pdfkit');
    const invoicesDir = path.join(__dirname, '..', '..', 'uploads', 'invoices');
    fs.mkdirSync(invoicesDir, { recursive: true });

    const filename = `invoice-${invoice._id}.pdf`;
    const filepath = path.join(invoicesDir, filename);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    doc.fontSize(20).text('Invoice', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).text(`Invoice ID: ${invoice._id}`);
    doc.text(`Order ID: ${invoice.order}`);
    doc.text(`Issued: ${invoice.issuedAt.toISOString()}`);
    doc.moveDown();

    doc.text('Items:');
    invoice.items.forEach(item => {
      doc.text(`${item.name} — ${item.qty} x ${item.price} = ${item.total}`);
    });

    doc.moveDown();
    doc.text(`Subtotal: ₹${invoice.subtotal.toFixed(2)}`);
    doc.text(`Taxes: ₹${invoice.taxes.toFixed(2)}`);
    if (invoice.discount) doc.text(`Discount: ₹${invoice.discount.toFixed(2)}`);
    doc.text(`Total: ₹${invoice.total.toFixed(2)}`);

    doc.end();

    // Wait for stream finish
    await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    return filepath;
  } catch (e) {
    // PDF generation not available or failed
    return null;
  }
}

async function createInvoiceForOrder(orderId) {
  const order = await Order.findById(orderId).populate('items.dish');
  if (!order) throw new Error('Order not found');

  const existing = await Invoice.findOne({ order: order._id });
  if (existing) return existing;

  const items = order.items.map(i => ({
    name: i.name,
    qty: i.qty,
    price: i.price,
    total: i.price * i.qty,
  }));

  const subtotal = items.reduce((s, it) => s + it.total, 0);
  // Simple tax calculation: 5% GST example
  const taxes = +(subtotal * 0.05).toFixed(2);
  const discount = 0;
  const total = +(subtotal + taxes - discount).toFixed(2);

  const invoice = new Invoice({
    order: order._id,
    user: order.user,
    items,
    subtotal,
    taxes,
    discount,
    total,
    paymentMethod: order.paymentMethod,
    paymentInfo: order.paymentInfo,
  });

  // Optionally generate PDF and store path
  const pdfPath = await generateInvoicePdf(invoice, order);
  if (pdfPath) invoice.pdfPath = pdfPath.replace(/\\/g, '/');

  await invoice.save();
  return invoice;
}

// Express handler to GET invoice for an order
const getInvoiceForOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const invoice = await Invoice.findOne({ order: orderId });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    // Ensure access: owner or admin
    if (req.user.role !== 'admin' && invoice.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const result = invoice.toObject();
    if (invoice.pdfPath) {
      // Expose URL path relative to uploads
      const rel = invoice.pdfPath.split('/uploads/').pop();
      result.pdfUrl = `${req.protocol}://${req.get('host')}/uploads/invoices/${path.basename(invoice.pdfPath)}`;
    }

    res.json(result);
  } catch (error) {
    console.error('getInvoiceForOrder error', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createInvoiceForOrder, getInvoiceForOrder };
