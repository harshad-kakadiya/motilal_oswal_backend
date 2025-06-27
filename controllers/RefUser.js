const User = require('../models/User');
const OTP = require('../models/OTP');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

exports.selectRefUser = async (req, res) => {
    try {
        const { refUserClientCode ,email} = req.body;
        const userId = req.user.id;

        if (!refUserClientCode || !email) {
            return res.status(400).json({ message: 'RefUser and email both are required' });
        }

        // Find ref user
        const refUser = await User.findOne({ clientcode: refUserClientCode });
        if (!refUser) {
            return res.status(404).json({ message: 'Ref user not found' });
        }

        // Check if user is trying to set themselves as ref user
        if (refUser._id.toString() === userId.toString()) {
            return res.status(400).json({ message: 'Cannot set yourself as ref user' });
        }

        // Update user with ref user
        const user = await User.findByIdAndUpdate(
            userId,
            {
                email,
                refUser: refUser._id,
                refUserStatus: 'pending',
                isRefUserApproved: false
            },
            { new: true }
        );

        // Generate OTP
        const otp = crypto.randomInt(100000, 999999).toString();

        // Save OTP to database
        await OTP.create({
            userId: userId,
            refUserId: refUser._id,
            otp: otp
        });

        // Send OTP email to ref user
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: refUser.email,
            subject: 'Trading Connection Request - OTP Verification',
            html: `
                <h3>Trading Connection Request</h3>
                <p>User ${user.name} (${user.clientcode}) wants to connect with you as their reference user.</p>
                <p>Your OTP for approval: <strong>${otp}</strong></p>
                <p>This OTP will expire in 5 minutes.</p>
                <p>If you approve this connection, all trading activities of this user will be mirrored to your account.</p>
            `
        };

        await transporter.sendMail(mailOptions);

        // Emit WebSocket event to ref user
        const io = req.app.get('io');
        io.to(`user_${refUser._id}`).emit('refUserRequest', {
            userId: userId,
            userName: user.name,
            userClientCode: user.clientcode,
            otp: otp,
            message: 'New ref user connection request'
        });

        res.json({
            message: 'OTP sent to ref user for approval',
            refUserName: refUser.name
        });

    } catch (error) {
        console.error('Error selecting ref user:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Verify OTP and approve connection
exports.verifyOTPAndApprove = async (req, res) => {
    try {
        const { otp, approve } = req.body;
        const refUserId = req.user.id; // Ref user verifying OTP

        // Find OTP record
        const otpRecord = await OTP.findOne({
            refUserId: refUserId,
            otp: otp,
            isUsed: false
        }).populate('userId');

        if (!otpRecord) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        // Mark OTP as used
        otpRecord.isUsed = true;
        await otpRecord.save();

        // Update user status based on approval
        const status = approve ? 'approved' : 'rejected';
        const isApproved = approve ? true : false;

        await User.findByIdAndUpdate(otpRecord.userId._id, {
            refUserStatus: status,
            isRefUserApproved: isApproved
        });

        // Emit WebSocket event to the requesting user
        const io = req.app.get('io');
        io.to(`user_${otpRecord.userId._id}`).emit('refUserApproval', {
            approved: approve,
            message: approve ? 'Your ref user connection has been approved' : 'Your ref user connection has been rejected'
        });

        res.json({
            message: approve ? 'Connection approved successfully' : 'Connection rejected',
            userDetails: {
                name: otpRecord.userId.name,
                clientcode: otpRecord.userId.clientcode
            }
        });

    } catch (error) {
        console.error('Error verifying OTP:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get connected users (for ref user)
exports.getConnectedUsers = async (req, res) => {
    try {
        const refUserId = req.user.id;

        const connectedUsers = await User.find({
            refUser: refUserId,
            isRefUserApproved: true
        }).select('name clientcode createdAt');

        res.json({ connectedUsers });

    } catch (error) {
        console.error('Error getting connected users:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};