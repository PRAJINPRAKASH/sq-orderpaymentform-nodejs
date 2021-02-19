/*
  Copyright 2019 Square Inc.
  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at
      http://www.apache.org/licenses/LICENSE-2.0
  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const squareConnect = require("square-connect");
const open = require("open");
const app = express();
const port = 3000;

// Set the Access Token
const APPLICATION_ID = process.env.APPLICATION_ID;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: false,
  })
);
app.use(express.static(__dirname + "/public"));
app.set("views", __dirname + "/views");
app.engine("html", require("ejs").renderFile);
app.set("view engine", "html");
app.get("/", function (req, res) {
  res.render("index.html", {
    ts: +new Date(),
  });
});
app.get("/payment/:order_id", function (req, res) {
  const { order_id } = req.params;
  console.log(order_id);
  res.render("payment.html", {
    APPLICATION_ID,
    order_id,
  });
});

// Set Square Connect credentials and environment
const defaultClient = squareConnect.ApiClient.instance;

// Configure OAuth2 access token for authorization: oauth2
const oauth2 = defaultClient.authentications["oauth2"];
oauth2.accessToken = ACCESS_TOKEN;

// Set 'basePath' to switch between sandbox env and production env
// sandbox: https://connect.squareupsandbox.com
// production: https://connect.squareup.com
defaultClient.basePath = "https://connect.squareupsandbox.com";

app.post("/process-payment", async (req, res) => {
  const request_params = req.body;
  // length of idempotency_key should be less than 45
  const idempotency_key = crypto.randomBytes(22).toString("hex");

  // Charge the customer's card
  const payments_api = new squareConnect.PaymentsApi();
  const request_body = {
    source_id: request_params.nonce,
    amount_money: {
      amount: 1, // $1.00 charge
      currency: "USD",
    },
    idempotency_key: idempotency_key,
    order_id: request_params.order_id,
  };

  try {
    const response = await payments_api.createPayment(request_body);
    res.status(200).json({
      title: "Payment Successful",
      result: response,
    });
  } catch (error) {
    res.status(500).json({
      title: "Payment Failure",
      result: error.response.text,
    });
  }
});

app.post("/create-order", async (req, res) => {
  try {
    const request_body = req.body;
    request_body.idempotency_key = crypto.randomBytes(22).toString("hex");
    const location_id = request_body.order.location_id;
    const orders_api = new squareConnect.OrdersApi();
    const response = await orders_api.createOrder(location_id, request_body);
    res.status(200).json({
      title: "Order Created",
      result: response,
    });
  } catch (error) {
    res.status(500).json({
      title: "Order Creation Failed",
      result: error.response
        ? error.response.text
          ? error.response.text
          : error.response
        : error,
    });
  }
});
app.listen(port, async () => {
  console.log(`listening on - http://localhost:${port}`);
  await open(`http://localhost:${port}`);
});
