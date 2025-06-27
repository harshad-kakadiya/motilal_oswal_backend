require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const loginRoutes = require('./routes/login');
const refUserRoutes = require('./routes/refUser');
const tradingRoutes = require('./routes/trading');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const { MONGO_URI, JWT_SECRET } = process.env;

app.use(cors());
app.use(express.json());
app.use(cookieParser());


app.set('io', io);

mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error('MongoDB Connection Failed:', err));

// WebSocket Authentication Middleware
const authenticateSocket = (socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
        return next(new Error('Authentication error'));
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.userId = decoded.userId;
        socket.clientcode = decoded.clientcode;
        next();
    } catch (err) {
        next(new Error('Authentication error'));
    }
};

io.use(authenticateSocket);

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.clientcode} (${socket.userId})`);

    // Join user to their personal room
    socket.join(`user_${socket.userId}`);

    // Handle ref user approval request
    socket.on('requestRefUserApproval', (data) => {
        // This event could be used for additional real-time interactions
        console.log('Ref user approval requested:', data);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.clientcode}`);
    });

    // Send welcome message
    socket.emit('connected', {
        message: 'Connected to trading system',
        userId: socket.userId
    });
});

app.use('/api/auth', loginRoutes);
app.use('/api/ref-user', refUserRoutes);
app.use('/api/trading', tradingRoutes);

app.get('/health', (req, res) => {
    res.json({
        message: 'Trading API Server is running',
        timestamp: new Date().toISOString()
    });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

app.use('*', (req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📡 WebSocket server ready`);
});