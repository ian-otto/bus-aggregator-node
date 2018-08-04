const express = require('express');
const router = express.Router();
const helpers  = require('../lib/helpers');
const BusNotifier = helpers.BusNotifier;
const Watcher = helpers.Watcher;
const NotificationHelper = helpers.NotificationHelper;
let busNotifier = new BusNotifier();
NotificationHelper.initialize_firebase();

const get_route_from_stop = (stop_id) => {
    for(let item of global.links) {
        if(item.stops_array !== undefined) {
            for(let obj of item.stops_array) {
                if(parseInt(stop_id) === obj.stopNumber)
                    return item;
            }
        } else {
            console.error("stopIdArray undefined");
        }
    }
    return null;
};

/* GET home page. */
router.get('/', function(req, res, next) {
    res.json({"version": "1.0"});
    res.setHeader("Cache-Control", "public, max-age=2592000");
    res.setHeader("Expires", new Date(Date.now() + 2592000000).toUTCString());
});

router.get('/routes', function (req, res, next) {
    let retval = [];
    global.links.forEach(function (current) {
        retval = retval.concat(current.get_routes());
    });
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Expires", new Date(Date.now() + 3600000).toUTCString());
    res.json(retval);
});

router.get('/stops', function (req, res, next) {
    let retval = [];
    global.links.forEach(function (current) {
        retval = retval.concat(current.get_stops());
    });
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Expires", new Date(Date.now() + 3600000).toUTCString());
    res.json(retval);
});

router.get('/stops/eta/:id', function (req, res, next) {
    if(!req.params.id || req.params.id < 0) {
        res.status(400);
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Expires", -1);
        res.json({"error": "Invalid stopID"});
        return;
    }
    let route = get_route_from_stop(req.params.id);
    if(!route) {
        res.status(400);
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Expires", -1);
        res.json({"error": "Unknown stopID"});
        return;
    }
    global.etaGrabber.get_eta_info(req.params.id, function (err, data) {
        if(err) {
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Expires", -1);
            res.json({error: err});
        } else {
            res.setHeader("Cache-Control", "public, max-age=15");
            res.setHeader("Expires", new Date(Date.now() + 15000).toUTCString());
            res.json(data);
        }
    })
});

router.get('/buses', function (req, res) {
    let retval = [];
    global.links.forEach(function (current) {
        retval = retval.concat(current.bus_array);
    });
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Expires", -1);
    res.json(retval);
});

router.put('/buses/notification', function (req, res) {
    if(req.body.bus_id && req.body.trip_id && req.body.stop_id && req.body.notification_token && req.body.time_before) {
        try {
            busNotifier.add_watcher(new Watcher(req.body.stop_id, req.body.bus_id, req.body.trip_id, req.body.notification_token, req.body.time_before));
            NotificationHelper.send_notification_created(req.body.notification_token, req.body.bus_id, req.body.time_before / 60 + " minutes");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Expires", -1);
            res.json({success: true});
        } catch(e) {
            console.log(e);
            res.status(400);
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Expires", -1);
            res.json({success: false, error: "Error in setting notification", stack: e});
        }
    }
});

module.exports = router;
