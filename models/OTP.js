const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    refUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    otp: {
        type: String,
        required: true
    },
    isUsed: {
        type: Boolean,
        default: false
    },
    expiresAt: {
        type: Date,
        default: Date.now,
        expires: 1800
    }
}, { timestamps: true });

module.exports = mongoose.model('OTP', otpSchema);