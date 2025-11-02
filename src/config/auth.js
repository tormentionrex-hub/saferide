const passport = require('passport');
const { BearerStrategy } = require('passport-azure-ad');
const BearerStrategy = require('passport-http-bearer').BearerStrategy;
require('dotenv').config();

const options = {
    identityMetadata: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/v2.0/.well-known/openid-configuration`,
    clientID: process.env.AZURE_CLIENT_ID,
    audience: process.env.AZURE_CLIENT_ID,
    validateUser: true,
    issuer: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/v2.0`,
    passRequestToCallback: false,
    loggingLevel: 'info',
    scope: ['openid', 'profile', 'email'],
};

const BearerStrategy = new BearerStrategy(options, (token, done) => {
    // Here you can implement your token validation logic

    return done(null, token, token);
});

passport.use(BearerStrategy);
module.exports = passport;
