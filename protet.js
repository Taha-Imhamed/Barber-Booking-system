//const stuff

const fs = require("fs");
const https = require("https");
const exxpress = require("express");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

const app = express();

//ssl config cuz why buy it 

const sslOption = {
        key : fs.readFileSync("./ssl/private.key"),
        cert: fs.readFileSync("./ssl/Certificate.crt")
};

//fire wall cuz needed 

const blockedIPs = [
    "192.168.1.100",
    "10.0.0.50"
];

//alowerd ip list 
// dont forget /
/////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////

const allowedIPs = [
    "192.168.121.1"
    //"server ip when we buy it "
]

//fire wall midwear

function firewall(req, res, next){
    const ip = req.headres["X-Forwarded-For"] || req.socket.remoteAddress;

    if (blockedIPs.includes(ip)){
        return res.status(403). send("ACCESS DENIED YA 7MAR")
    }

    next();
}

//rate limit{anti ddps }
//rate 
//win 15 *60  max 50  "too many req "

// jwt pls 
//ssl is dis for push (not yet )


