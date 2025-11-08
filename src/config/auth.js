const passport = require('passport');
const { BearerStrategy: AzureBearerStrategy } = require('passport-azure-ad');
require('dotenv').config();

const options = {
    identityMetadata: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}/v2.0/.well-known/openid-configuration`,
    clientID: process.env.ENTRA_CLIENT_ID,
    audience: process.env.ENTRA_CLIENT_ID,
    validateUser: true,
    issuer: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}/v2.0`,
    passRequestToCallback: false,
    loggingLevel: 'info',
    scope: ['openid', 'profile', 'email'],
};

const bearerStrategy = new AzureBearerStrategy(options, (token, done) => {
    // Here you can implement your token validation logic
    return done(null, token, token);
});

passport.use(bearerStrategy);
module.exports = passport;
