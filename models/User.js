const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    clientcode: String,
    name: String,
    exchanges: [String],
    products: [String],
    usertype: String,
    authtoken: String,
    apikey: String,
    role: {
        type: String,
        enum: ['admin', 'user'],
        default: 'user'
    },
    refUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    refUserStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: null
    },
    email: String,
    isRefUserApproved: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);