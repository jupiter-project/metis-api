// import { Router, Request, Response } from 'express';
// import middlewares from '../middlewares';
"use strict";
module.exports = (app, jobs, websocket)=>{
    app.get('/jim/v1/api/ping', (req, res, next)=>{
        return res.status(200).json({
            message: 'pong'
        });
    });
};
