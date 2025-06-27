const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { PROFILE_API, JWT_SECRET } = process.env;

exports.motilalLogin = {
    redirectToMotilal: (req, res) => {
        const { apikey } = req.query;

        if (!apikey) {
            return res.status(400).send('API key is required');
        }

        const callbackRedirect = `https://motilal-oswal-be.onrender.com/api/auth/callback`;

        const redirectUrl = `https://invest.motilaloswal.com/OpenAPI/Login.aspx?apikey=${apikey}&redirectUrl=${encodeURIComponent(callbackRedirect)}&state=${apikey}`;

        res.redirect(redirectUrl);
    },

    // 🔄 Step 2: Handle Callback
    handleCallback: async (req, res) => {
        const { authtoken, state: apikey } = req.query;
        console.log(authtoken, apikey);

        if (!authtoken || !apikey) {
            return res.status(400).send('Missing authtoken or apikey');
        }

        try {
            const response = await axios.post(PROFILE_API, {}, {
                headers: {
                    Accept: 'application/json',
                    Authorization: authtoken,
                    'User-Agent': 'MOSL/V.1.0.0',
                    apikey,
                    sourceid: 'web',
                    macaddress: '00:50:56:BD:F4:0B',
                    clientlocalip: '127.0.0.1',
                    clientpublicip: '1.2.3.4'
                }
            });

            const data = response.data;

            if (data.status !== 'SUCCESS') {
                return res.status(400).json(data);
            }

            const userInfo = data.data;

            // 🔍 Find the admin user to set as refUser
            const adminUser = await User.findOne({ role: 'admin' });

            // 🧠 Prepare update payload
            const updatePayload = {
                ...userInfo,
                authtoken,
                apikey,
            };

            // 💡 If user is new, assign admin as refUser
            let user = await User.findOne({ clientcode: userInfo.clientcode });

            if (!user) {
                updatePayload.refUser = adminUser?._id || null;
            }

            // 🔄 Upsert the user
            user = await User.findOneAndUpdate(
                { clientcode: userInfo.clientcode },
                updatePayload,
                { upsert: true, new: true }
            );

            const token = jwt.sign(
                { userId: user._id, clientcode: user.clientcode },
                JWT_SECRET
            );

            res.json({
                message: 'Login successful',
                user: {
                    id: user._id,
                    name: user.name,
                    clientcode: user.clientcode,
                    refUser: user.refUser,
                    isRefUserApproved: user.isRefUserApproved
                },
                token
            });

        } catch (err) {
            console.error('Error fetching profile:', err.response?.data || err.message);
            res.status(500).send('Error fetching profile from Motilal Oswal.');
        }
    }

};
