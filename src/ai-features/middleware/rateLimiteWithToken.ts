import type {Response, Request, NextFunction} from 'express';

import express from "express";
import { encoding_for_model } from "tiktoken";

const app = express();

app.use(express.json());

const encoder = encoding_for_model("gpt-4o-mini");

/**
 * Count tokens helper
 */
function countTokens(text = "") {
  return encoder.encode(text).length;
}

/**
 * Token counting middleware
 */
export default function tokenCounter(req : Request, res : Response, next : NextFunction) {
  const requestBody = JSON.stringify(req.body || {});
  const requestTokens = countTokens(requestBody);

  console.log("Request Tokens:", requestTokens);

  // Store original send
  const originalSend = res.send;
  const originalWrite = res.write;

  res.send = function (body) {
    const responseBody =
      typeof body === "string" ? body : JSON.stringify(body);

    const responseTokens = countTokens(responseBody);

    console.log("Response Tokens:", responseTokens);
    console.log("Total Tokens:", requestTokens + responseTokens);

    // Optional headers
    // res.setHeader("X-Request-Tokens", requestTokens);
    // res.setHeader("X-Response-Tokens", responseTokens);
    // res.setHeader(
    //   "X-Total-Tokens",
    //   requestTokens + responseTokens
    // );

    return originalSend.call(this, body);
  };
  let responseTokens = 0
    res.write = function (chunks, ...args:unknown[]) {
    const responseBody =
      typeof chunks === "string" ? chunks : JSON.stringify(chunks);

      
       responseTokens += countTokens(responseBody);
      
       
       
       
       
       
       // Optional headers
       // res.setHeader("X-Request-Tokens", requestTokens);
       // res.setHeader("X-Response-Tokens", responseTokens);
       // res.setHeader(
        //   "X-Total-Tokens",
        //   requestTokens + responseTokens
        // );
        return originalWrite.apply(res, [chunks, ...args]);
        // return originalWrite.call(this, [chunks,...args]);
      };
      
      res.on("finish", ()=>{

        // console.log("############################")
        console.log("Response Tokens:", requestTokens);
        console.log("Response Tokens:", responseTokens);
         console.log("Total Tokens:", requestTokens + responseTokens);
        // console.log("############################")
      })
      
      next();
      
}



// app.use(tokenCounter);

// app.post("/chat", (req, res) => {
//   res.json({
//     message: "Hello from API",
//   });
// });

// app.listen(3000, () => {
//   console.log("Server running on port 3000");
// });