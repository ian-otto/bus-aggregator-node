const express = require('express');
const router = express.Router();
const redis = require("redis");
const redis_config = require('../redis_settings.json');
let redis_cli = null;
const get_redis_client = function () {
    if(redis_cli)
        return redis_cli;
    redis_cli = redis.createClient(redis_config);
    redis_cli.on('error', function (err) {
        console.log("Redis client error");
    });
    return redis_cli;
};
get_redis_client(); // setup redis connection IMMEDIATELY
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
});

router.get('/routes', function (req, res, next) {
    let retval = [];
    global.links.forEach(function (current) {
        retval = retval.concat(current.get_routes());
    });
    res.json(retval);
});

router.get('/stops', function (req, res, next) {
    let retval = [];
    global.links.forEach(function (current) {
        retval = retval.concat(current.get_stops());
    });
    res.json(retval);
});

router.get('/stops/eta/:id', function (req, res, next) {
    if(!req.params.id || req.params.id < 0) {
        res.status(400);
        res.json({"error": "Invalid routeID"});
        return;
    }
    let route = get_route_from_stop(req.params.id);
    if(!route) {
        res.status(400);
        res.json({"error": "Unknown routeID"});
        return;
    }
    let cli = get_redis_client();
    if(cli.connected) {
        cli.get(req.params.id, function (err, c_data) {
            if(err || c_data === null) {
                route.get_arrival_time(req.params.id, function(err, data) {
                    if(err) {
                        console.log(err);
                        cli.setex(req.params.id, 10, JSON.stringify({error: err}));
                        res.json({error: err});
                    } else {
                        cli.setex(req.params.id, 10, JSON.stringify(data));
                        res.json(data);
                    }
                });
            } else {
		c_data = JSON.parse(c_data); //TODO: find a better way to do this
                res.json(c_data);
            }
        });
    } else {
        route.get_arrival_time(req.params.id, function(err, data) {
            if(err) {
                console.log(err);
                res.json({error: err});
            } else {
                res.json(data);
            }
        });
    }
});

router.get('/buses', function (req, res) {
    let retval = [];
    global.links.forEach(function (current) {
        retval = retval.concat(current.bus_array);
    });
    res.json(retval);
});

module.exports = router;
