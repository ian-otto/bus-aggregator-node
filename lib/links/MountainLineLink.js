const Link = require("./Link");
const request = require('request');
const route_model = require('../models/Route');
const stop_model = require('../models/Stop');
const shape_model = require('../models/Shape');
const bus_model = require('../models/Bus');
const etainfo_model = require('../models/ETAInfo');
const polyline = require('polyline');

class MountainLineLink extends Link {
    constructor() {
        super();
    }

    get_name() {
        return "Mountain Line";
    }

    fetch_routes() {
        // https://mline.usetransit.com/api/1/public/routes/0/4
        this.in_progress_updates++;
        request("https://mline.usetransit.com/api/1/public/routes/0/4", (err, res, body_str) => {
            if(err) {
                console.error("Failed to call MountainLine route call: ");
                console.error(err);
                return;
            }
            try {
                let body = JSON.parse(body_str);
                this._convert_routes_call(body);
            } catch(e) {
                console.error("JSON parser fail in fetch_routes");
                console.error(e);
            }
            this.in_progress_updates--;
        });
    }

    fetch_stops() {
        this.in_progress_updates++;
        request("https://mline.usetransit.com/api/1/public/stops/4", (err, res, body_str) => {
            if(err) {
                console.error("Failed to call MountainLine route call: ");
                console.error(err);
                return;
            }
            try {
                let body = JSON.parse(body_str);
                this._convert_stops_call(body);
            } catch(e) {
                console.error("JSON parser fail in fetch_routes");
                console.error(e);
            }
            this.in_progress_updates--;
        });
    }

    /**
     Warning! Obnoxiously long API response. This WILL lag the server. Call it sparingly.
     */
    fetch_shapes() {
        this.in_progress_updates++;
        request("https://mline.usetransit.com/api/1/public/shapes/4", (err, res, body_str) => {
            if(err) {
                console.error("Failed to call MountainLine route call: ");
                console.error(err);
                return;
            }
            try {
                let body = JSON.parse(body_str);
                this._convert_shapes_call(body);
            } catch(e) {
                console.error("JSON parser fail in fetch_routes");
                console.error(e);
            }
            this.in_progress_updates--;
        });
    }

    fetch_buses() {
        request("https://mline.usetransit.com/api/1/public/realtime/busLocations/4", (err, res, body_str) => {
            if(err) {
                console.error("Failed to call ML arrival time:");
                console.error(err);
            } else {
                //TODO: add in cached responses with very short cache time
                try {
                    let body_json = JSON.parse(body_str);
                    let busLocs = [];
                    for(let part of body_json) {
                        let status = part.stopStatus;
                        if(status) {
                            switch (status.toUpperCase()) {
                                case "IN_TRANSIT_TO":
                                    status = bus_model.BusStatus.DRIVING();
                                    break;
                                case "STOPPED_AT":
                                    status = bus_model.BusStatus.STOPPED();
                                    break;
                                default:
                                    status = bus_model.BusStatus.UNKNOWN();
                            }
                            let tmp = new bus_model.BusBuilder();
                            tmp.setAndReturn("vehicleId", part.busNumber)
                                .setAndReturn("status", status)
                                .setAndReturn("routeNumber", parseInt(part.currentRoute));
                            tmp.setLocation(part.latitude, part.longitude);
                            busLocs.push(tmp.build());
                        }
                    }
                    this.bus_array = busLocs;
                    this.emit('updated_buses');
                } catch(e) {
                    console.error("error parsing body");
                    console.error(e);
                }
            }
        });
    }

    get_arrival_time(stopNumber, cb) {
        request("https://mline.usetransit.com/api/1/public/realtime/eta/stop/" + stopNumber + "/4", (err, res, body_str) => {
            if(err) {
                console.error("Failed to call ML arrival time:");
                console.error(err);
                cb(err, null);
            } else {
                //TODO: add in cached responses with very short cache time
                try {
                    let body_json = JSON.parse(body_str);
                    let etas = [];
                    if(body_json.error || body_json.message) {
                        cb(null, etas);
                        return;
                    }
                    for(let part of body_json.data) {
                        if(part.etaSecs > 0) { // do not return data for buses that have passed already.
                            let tmp = new etainfo_model.ETAInfoBuilder();
                            etas.push(tmp.setAndReturn("vehicleId", part.busNumber)
                                .setAndReturn("etaSeconds", part.etaSecs)
                                .setAndReturn("routeId", part.routeNumber)
                                .setAndReturn("linkName", "Mountain Line").build());
                        }
                    }
                    cb(null, etas);
                } catch(e) {
                    cb(e, null);
                }
            }
        });
    }

    _convert_shapes_call(body_json) {
        let tmp_obj = {};
        let indexed = {};
        for(let i = 0; i < body_json.length; i++) {
            let current = body_json[i];
            if (!indexed.hasOwnProperty(current.shapeNumber)) {
                indexed[current.shapeNumber] = [];
            }
            indexed[current.shapeNumber].push([current.shapePtLat, current.shapePtLon]);
        }
        for (let property in indexed) {
            if (indexed.hasOwnProperty(property)) {
                let sb = new shape_model.ShapeBuilder();
                tmp_obj[property] = sb.setAndReturn('polyline', [ polyline.encode(indexed[property]) ]).build();
            }
        }
        this.shape_object = tmp_obj;
        this.emit('updated_shapes');
    }

    _convert_stops_call(body_json) {
        let tmp_arr = [];
        for(let i = 0; i < body_json.length; i++) {
            let current = body_json[i];
            let sb = new stop_model.StopBuilder();
            let stop = sb.setAndReturn('stopNumber', current['stopNumber'])
                .setAndReturn('stopName', current['stopName'])
                .setAndReturn('lat', current['latitude'])
                .setAndReturn('lng', current['longitude']).build();
            tmp_arr.push(stop);
        }
        this.stops_array = tmp_arr;
        this.emit('updated_stops');
    }

    _convert_routes_call(body_json) {
        let tmp_arr = [];
        for(let i = 0; i < body_json.length; i++) {
            let current = body_json[i];
            let stop_arr = [];
            current.stops.forEach(function(item) {
                if(item.isActive) {
                    stop_arr.push(item.stopNumber)
                }
            });
            let rb = new route_model.RouteBuilder();
            let trip_shape = current.tripShapes[0].shapeNumber; //have a default in case of failure.
            for(let o of current.tripShapes) {
                if(o.isDefault) {
                    trip_shape = o.shapeNumber;
                    break;
                }
            }
            let route = rb.setAndReturn('humanName', current['routeLongName'])
                .setAndReturn('routeNumber', current['routeNumber'])
                .setAndReturn('shortName', current['routeName'])
                .setAndReturn('color', current['colour'])
                .setAndReturn('textColor', current['textColour'])
                .setAndReturn('active', true)
                .setAndReturn('stopIdArray', stop_arr).setAndReturn("shapeId", trip_shape).build();
            tmp_arr.push(route);
        }
        this.route_array = tmp_arr;
        this.emit('updated_routes');
    }

    /**
     *
     * @param item Route
     */
    build_route(item) {
        item.setRouteShape(this.shape_object[item.shapeId]);
        return item;
    }
}

module.exports = MountainLineLink;