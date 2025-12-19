const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [{
    name: String,
    qty: Number,
    price: Number,
    total: Number,
  }],
  subtotal: { type: Number, default: 0 },
  taxes: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  total: { type: Number, required: true },
  paymentMethod: { type: String },
  paymentInfo: { type: Object },
  issuedAt: { type: Date, default: Date.now },
  pdfPath: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Invoice', invoiceSchema);
