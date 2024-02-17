// redis.js

const session = require('express-session');
const RedisStore = require("connect-redis").default;
const redis = require('redis');

// Create and connect the Redis client
const redisClient = redis.createClient({
    url: 'redis://localhost:6379' // Adjust as needed for your Redis server configuration
});

(async () => {
    await redisClient.connect();
})();

redisClient.on('error', (err) => console.error('Could not establish a connection with Redis:', err));
redisClient.on('connect', () => console.log('Connected to Redis successfully'));

// Configure session middleware to use Redis
const sessionMiddleware = session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET || 'yourSecret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
});

module.exports = { sessionMiddleware, redisClient };