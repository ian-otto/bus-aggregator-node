const express = require('express');
const router = express.Router();

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
        res.json({"error": "Invalid stopID"});
        return;
    }
    let route = get_route_from_stop(req.params.id);
    if(!route) {
        res.status(400);
        res.json({"error": "Unknown stopID"});
        return;
    }
    global.etaGrabber.get_eta_info(req.params.id, function (err, data) {
        if(err) {
            res.json({error: err});
        } else {
            res.json(data);
        }
    })
});

router.get('/buses', function (req, res) {
    let retval = [];
    global.links.forEach(function (current) {
        retval = retval.concat(current.bus_array);
    });
    res.json(retval);
});

module.exports = router;
