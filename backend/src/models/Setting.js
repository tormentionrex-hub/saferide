const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, trim: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true, collection: 'settings' });

module.exports = mongoose.model('Setting', settingSchema);
