
"use strict";
const fs = require('fs')

require('dotenv').config();

const express = require("express");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const db = require('./db');
const { StateUpdateRequest, SchemaConnector } = require('st-schema');
const SmartThingsConnector = require('./connector'); // SmartThings integration
//const { sessionMiddleware } = require('./redis'); // Redis database
const morgan = require('morgan'); // Morgan to print logs
const path = require("path");
const ejs = require("ejs");
const crypto = require('crypto'); //

//const dotenv = require("dotenv");
//dotenv.config("../");

const app = express();
const PORT = process.env.PORT || 3000;

function generateStateParameter() {
  return crypto.randomBytes(16).toString('hex');
}

app.set("view engine", "ejs");

app.use(express.json());
app.use(morgan("HTTP :method :url :res[location] :status :response-time ms"));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "https://ed12-173-95-25-215.ngrok-free.app/auth/google/callback",
      //prompt: 'select_account' 
    },
    function (accessToken, refreshToken, profile, cb) {
      // Use the profile information to authenticate the user
      // ...
      cb(null, profile);
    }
  )
);

passport.serializeUser(function (user, cb) {
  cb(null, user);
});

passport.deserializeUser(function (obj, cb) {
  cb(null, obj);
});

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, "public")));

app.get("/login", (req, res) => {
  res.render(path.join(__dirname, "login.ejs"));
});

app.get("/dashboard", (req, res) => {
  // check if user is logged in
  if (req.isAuthenticated()) {
    //console.log(req);
    res.render(path.join(__dirname, "dashboard.ejs"), { user: req.user });
  } else {
    res.redirect("/login");
  }
});

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

///Smarthing redirect
//app.get("/redirect-to-smartthings", (req, res) => {
  //const clientId = process.env.ST_CLIENT_ID;
  //const redirectUri = encodeURIComponent("https://ed12-173-95-25-215.ngrok-free.app/smartthings/callback"); // Your server's redirect URI
    //const state = generateStateParameter();
        // Save the state in the user's session or a similar mechanism to validate it later
    //req.session.oauthState = state;

   // const smartThingsAuthUrl = `https://api.smartthings.com/oauth/authorize?client_id=${clientId}&response_type=code&scope=r:devices:*&redirect_uri=${redirectUri}&state=${state}`;

    //res.redirect(smartThingsAuthUrl);
    //res.redirect('/redirect-to-smartthings');
    //console.log("client_ID"+clientID);
    //console.log("client_Secret"+clientSecret);
   // res.redirect('/connector');
   // console.log("RedirectURL"+redirectUri);
   // console.log("client_state: "+state);
//});

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function (req, res) {
    //res.redirect('/connector');
    //res.redirect("/dashboard");
    res.redirect("/initiate-discovery");
    // Here, instead of redirecting to /dashboard, redirect to SmartThings or another desired URL
    //res.redirect("https://api.smartthings.com/oauth/authorize?client_id=YOUR-CLIENT-ID&scope=user:email");
    //res.redirect("https://api.smartthings.com/oauth/callback");
  }
);

app.get("/initiate-discovery", (req, res) => {
  if (req.isAuthenticated()) {
    console.log("[/initiate-discovery] User is authenticated, initiating discovery.");

    // Setup for discoveryResponse object to mimic the expected structure by discoveryHandler
    let discoveryResponse = {
      devices: [],
      addDevice: function(id, type, deviceId) {
        const device = {
          externalDeviceId: id,
          deviceType: type,
          deviceId: deviceId,
          manufacturerName: function(name) { this.manufacturer = name; return this; },
          modelName: function(name) { this.model = name; return this; },
          // Assuming addComponent is a method you've defined that correctly modifies the device object
          addComponent: function(component, capability, version) {
            // You need to define the structure of the component here
            // For example:
            this.components = this.components || {};
            this.components[component] = { capability: capability, version: version };
            return this;
          },
        };
        this.devices.push(device);
        return device; // Allows chaining of manufacturerName, modelName and addComponent
      }
    };

    // Invoke the discoveryHandler, which is expected to populate the discoveryResponse object
    try {
      SmartThingsConnector.discoveryHandler("dummy_access_token", discoveryResponse);
      
      // Log the discoveryResponse to verify if devices have been added by the discoveryHandler
      console.log("[/initiate-discovery] Final discovery response:", discoveryResponse);

      // Verify the content of discoveryResponse.devices before rendering
      console.log("[/initiate-discovery] Rendering discovery with devices:", discoveryResponse.devices);

      // Render the discovery view with the devices
      res.render("discovery", { devices: discoveryResponse.devices });
    } catch (error) {
      console.error("[/initiate-discovery] Discovery error:", error);
      res.status(500).send("Discovery process failed");
    }
  } else {
    console.log("[/initiate-discovery] User not authenticated, redirecting to login.");
    res.redirect("/login");
  }
});



app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      console.log(err);
    } else {
      res.redirect("/login");
    }
  });
});

// COde added on 13th feb
// Endpoint for SmartThings to discover devices
app.post('/st/discovery', (req, res) => {
  SmartThingsConnector.discoveryHandler(req.headers.authorization, req.body)
    .then((discoveryResponse) => {
      res.json(discoveryResponse);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Discovery process failed' });
    });
});

// Endpoint for SmartThings to refresh device state
app.post('/st/state', (req, res) => {
  SmartThingsConnector.stateRefreshHandler(req.headers.authorization, req.body)
    .then((stateRefreshResponse) => {
      res.json(stateRefreshResponse);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'State refresh process failed' });
    });
});

// Endpoint for SmartThings to send commands to devices
app.post('/st/command', (req, res) => {
  SmartThingsConnector.commandHandler(req.headers.authorization, req.body)
    .then((commandResponse) => {
      res.json(commandResponse);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Command process failed' });
    });
});

app.listen(PORT, () => console.log(`Server listening on http://127.0.0.1:${PORT}`));
