require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");

const app = express();



/*
   FIREWALL FUNCTION
   Blocks malicious IP addresses
*/


function firewall(req, res, next)
{

    const blockedIPs = [
        "123.45.67.89",
        "111.222.333.444"
    ];

    const ip = req.ip;

    if (blockedIPs.includes(ip))
    {
        return res.status(403).json({
            success: false,
            message: "Access denied (IP blocked)"
        });
    }

    next();
}




/* 
   RATE LIMIT FUNCTION
   Protects against spam / DDoS
*/

function rateLimiter()
{
    return rateLimit({

        windowMs: 15 * 60 * 1000,

        max: 100,

        message:
        {
            success: false,
            message: "Too many requests. Try again later."
        }

    });
}




/* 
   SECURITY MIDDLEWARE FUNCTION
   Headers + JSON protection
*/

function securityMiddleware()
{

    app.use(express.json());

    app.use(helmet());

    app.use(cors({

        origin: [
            "http://localhost:3000",
            "https://yourdomain.com"
        ]

    }));

}




/* 
   LOGGER FUNCTION
*/

function logger()
{
    app.use(morgan("combined"));
}




/* 
   PAYMENT FUNCTION
   connect payment API here later cuz n oapi yet usesd sepaay 

 */

async function createPayment(req, res)
{

    const { amount, service } = req.body;

    if (!amount)
    {
        return res.status(400).json({
            success: false,
            message: "Amount is required"
        });
    }

    try
    {

        /* Example payment creation
        fake data jsut to test for now later i will change 
        font panicc 
        
        */

        const paymentSession =
        {
            id: "PAY_" + Date.now(),
            amount: amount,
            service: service,
            status: "created"
        };

        res.json({
            success: true,
            payment: paymentSession
        });

    }
    catch (error)
    {

        res.status(500).json({
            success: false,
            message: "Payment creation failed"
        });

    }

}




/*
   ROUTES FUNCTION
 */

function routes()
{

    app.get("/api/health", (req, res) =>
    {
        res.json({
            status: "API running"
        });
    });


    app.post("/api/payment/create", createPayment);

}




/* 
   SERVER INITIALIZATION
*/

function startServer()
{

    securityMiddleware();

    logger();

    app.use(firewall);

    app.use(rateLimiter());

    routes();

    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () =>
    {
        console.log("Secure server running on port " + PORT);
    });

}




/*
   START
 */

startServer();