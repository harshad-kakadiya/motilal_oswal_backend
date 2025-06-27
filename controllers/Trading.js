const axios = require('axios');
const User = require('../models/User');

const { MOTILAL_ORDER_API } = process.env;

// Reusable function to construct the order payload dynamically
const constructOrderPayload = ({
                                   user,
                                   exchange,
                                   symboltoken,
                                   buyorsell,
                                   quantity,
                                   price,
                                   ordertype = 'MARKET',
                                   producttype = 'NORMAL',
                                   orderduration = 'DAY',
                                   triggerprice = 0,
                                   disclosedquantity = 0,
                                   amoorder = 'N',
                                   goodtilldate = '',
                                   algoid = '',
                                   tag = ''
                               }) => {
    return {
        clientcode: user.clientcode || '',
        exchange,
        symboltoken,
        buyorsell,
        ordertype,
        producttype,
        orderduration,
        price: parseFloat(price),
        triggerprice: parseFloat(triggerprice),
        quantityinlot: parseInt(quantity),
        disclosedquantity: parseInt(disclosedquantity),
        amoorder,
        goodtilldate,
        algoid,
        tag,
        participantcode: user.participantcode || ''
    };
};

// Axios call to Motilal API
const placeMotilalOrder = async (authtoken, orderData, apiKey) => {
    try {
        const response = await axios.post(MOTILAL_ORDER_API, orderData, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'MOSL/V.1.0.0',
                'Authorization': authtoken,
                'apikey': apiKey,
                'apisecretkey': '9e16796b-ef5b-49aa-bb1a-4c24a51f32f8',
                'macaddress': '00:50:56:BD:F4:0B',
                'clientlocalip': '127.0.0.1',
                'clientpublicip': '1.2.3.4',
                'sourceid': 'web',
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        console.error('Motilal API Error:', error.response?.data || error.message);
        throw error;
    }
};

exports.buyStock = async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            symboltoken,
            quantity,
            price,
            orderType,
            exchange,
            producttype,
            orderduration,
            triggerprice,
            disclosedquantity,
            amoorder,
            goodtilldate,
            algoid,
            tag
        } = req.body;

        const user = await User.findById(userId).populate('refUser');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const buyOrderData = constructOrderPayload({
            user,
            exchange,
            symboltoken,
            buyorsell: 'BUY',
            quantity,
            price,
            ordertype: orderType,
            producttype,
            orderduration,
            triggerprice,
            disclosedquantity,
            amoorder,
            goodtilldate,
            algoid,
            tag
        });

        const buyOrderResult = await placeMotilalOrder(user.authtoken, buyOrderData, user.apikey);

        if (buyOrderResult.status === 'SUCCESS') {
            const sellOrderData = constructOrderPayload({
                user: user.refUser,
                exchange,
                symboltoken,
                buyorsell: 'SELL',
                quantity,
                price,
                ordertype: orderType,
                producttype,
                orderduration,
                triggerprice,
                disclosedquantity,
                amoorder,
                goodtilldate,
                algoid,
                tag
            });

            try {
                const refUserSellResult = await placeMotilalOrder(user.refUser.authtoken, sellOrderData, user.refUser.apikey);

                const io = req.app.get('io');
                io.to(`user_${userId}`).emit('orderPlaced', {
                    type: 'BUY',
                    symboltoken,
                    quantity,
                    price,
                    orderId: buyOrderResult.uniqueorderid,
                    status: 'SUCCESS'
                });

                io.to(`user_${user.refUser._id}`).emit('mirrorOrderPlaced', {
                    type: 'SELL',
                    symboltoken,
                    quantity,
                    price,
                    orderId: refUserSellResult.uniqueorderid,
                    status: 'SUCCESS',
                    triggeredBy: {
                        name: user.name,
                        clientcode: user.clientcode
                    }
                });

                return res.json({
                    message: 'Buy order placed successfully',
                    userOrder: buyOrderResult,
                    refUserOrder: refUserSellResult
                });

            } catch (refOrderError) {
                return res.json({
                    message: 'Buy order placed but ref user mirror order failed',
                    userOrder: buyOrderResult,
                    refUserOrderError: refOrderError.message
                });
            }

        } else {
            return res.status(400).json({
                message: 'Failed to place buy order',
                error: buyOrderResult
            });
        }

    } catch (error) {
        console.error('Error in buyStock:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.sellStock = async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            symboltoken,
            quantity,
            price,
            orderType,
            exchange,
            producttype,
            orderduration,
            triggerprice,
            disclosedquantity,
            amoorder,
            goodtilldate,
            algoid,
            tag
        } = req.body;

        const user = await User.findById(userId).populate('refUser');
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (!user.isRefUserApproved) {
            return res.status(400).json({ message: 'Ref user approval required for trading' });
        }

        const sellOrderData = constructOrderPayload({
            user,
            exchange,
            symboltoken,
            buyorsell: 'SELL',
            quantity,
            price,
            ordertype: orderType,
            producttype,
            orderduration,
            triggerprice,
            disclosedquantity,
            amoorder,
            goodtilldate,
            algoid,
            tag
        });

        const sellOrderResult = await placeMotilalOrder(user.authtoken, sellOrderData, user.apikey);

        if (sellOrderResult.status === 'SUCCESS') {
            const buyOrderData = constructOrderPayload({
                user: user.refUser,
                exchange,
                symboltoken,
                buyorsell: 'BUY',
                quantity,
                price,
                ordertype: orderType,
                producttype,
                orderduration,
                triggerprice,
                disclosedquantity,
                amoorder,
                goodtilldate,
                algoid,
                tag
            });

            try {
                const refUserBuyResult = await placeMotilalOrder(user.refUser.authtoken, buyOrderData, user.refUser.apikey);

                return res.json({
                    message: 'Sell order placed successfully',
                    userOrder: sellOrderResult,
                    refUserOrder: refUserBuyResult
                });

            } catch (refOrderError) {
                return res.json({
                    message: 'Sell order placed but ref user mirror order failed',
                    userOrder: sellOrderResult,
                    refUserOrderError: refOrderError.message
                });
            }

        } else {
            return res.status(400).json({
                message: 'Failed to place sell order',
                error: sellOrderResult
            });
        }

    } catch (error) {
        console.error('Error in sellStock:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
