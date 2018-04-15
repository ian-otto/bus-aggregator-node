const Link = require("./Link");
const request = require('request');
const route_model = require('../models/Route');
const stop_model = require('../models/Stop');
const shape_model = require('../models/Shape');
const bus_model = require('../models/Bus');
const etainfo_model = require('../models/ETAInfo');
const polyline = require('polyline');

class TranslocLink extends Link {
    constructor() {
        super();
    }

    get_name() {
        return "Transloc";
    }

    fetch_routes() {
        // https://mline.usetransit.com/api/1/public/routes/0/4
        this.in_progress_updates++;
        request("https://feeds.transloc.com/3/routes?agencies=76", (err, res, body_str) => {
            if(err) {
                console.error("Failed to call MountainLine route call: ");
                console.error(err);
                return;
            }
            try {
                let body = JSON.parse(body_str).routes;
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
        request("https://feeds.transloc.com/3/stops?include_routes=true&agencies=76", (err, res, body_str) => {
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
        request("https://feeds.transloc.com/3/segments?agencies=76", (err, res, body_str) => {
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
        request("http://feeds.transloc.com/3/vehicle_statuses?agencies=76", (err, res, body_str) => {
            if(err) {
                console.error("Failed to call TL arrival time:");
                console.error(err);
            } else {
                //TODO: add in cached responses with very short cache time
                try {
                    let body_json = JSON.parse(body_str);
                    let busLocs = [];
                    for(let part of body_json.vehicles) {
                        let status = bus_model.BusStatus.UNKNOWN();
                        if(part.speed > 0) {
                            status = bus_model.BusStatus.DRIVING();
                        } else if(part.speed === 0) {
                            status = bus_model.BusStatus.STOPPED();
                        }
                        let tmp = new bus_model.BusBuilder();
                        tmp.setAndReturn("vehicleId", part.id)
                            .setAndReturn("status", status)
                            .setAndReturn("routeNumber", part.route_id)
                            .setAndReturn("location", part.position);
                        busLocs.push(tmp.build());
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
        request("https://feeds.transloc.com/3/arrivals?agencies=76&stop_id=" + stopNumber, (err, res, body_str) => {
            if(err) {
                console.error("Failed to call TL arrival time:");
                console.error(err);
                cb(err, null);
            } else {
                //TODO: add in cached responses with very short cache time
                try {
                    let body_json = JSON.parse(body_str);
                    let etas = [];
                    for(let part of body_json.arrivals) {
                        let tmp = new etainfo_model.ETAInfoBuilder();
                        etas.push(tmp.setAndReturn("vehicleId", part.vehicle_id)
                            .setAndReturn("etaSeconds", new Date().getTime() - part.timestamp * 1000)
                            .setAndReturn("routeId", part.route_id)
                            .setAndReturn("linkName", "Transloc").build());
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
        let availableSegments = {};
        let seg_json = body_json['segments'];
        let route_json = body_json['routes'];
        // parse out the segments and sort them.
        for(let i = 0; i < seg_json.length; i++) {
            let current = seg_json[i];
            availableSegments[current.id] = current.points;
        }
        for (let route of route_json) {
            let pt_arr = [];
            for(let wanted_seg of route.segments) {
                wanted_seg = Math.abs(wanted_seg);
                if(availableSegments.hasOwnProperty(wanted_seg)) {
                    pt_arr = pt_arr.concat(availableSegments[wanted_seg]);
                }
            }
            tmp_obj[route.id] = new shape_model.ShapeBuilder().setAndReturn('polyline', pt_arr).build();
        }
        this.shape_object = tmp_obj;
        this.emit('updated_shapes');
    }

    _convert_stops_call(body_json) {
        let tmp_arr = [];
        for(let i = 0; i < body_json['routes'].length; i++) {
            let current = body_json['routes'][i];
            for(let j = 0; j < this.route_array.length; j++) {
                if (current.id === this.route_array[j].routeNumber) {
                    this.route_array[j].stopIdArray = current.stops;
                }
            }
        }
        for(let i = 0; i < body_json['stops'].length; i++) {
            let current = body_json['stops'][i];
            let sb = new stop_model.StopBuilder();
            let stop = sb.setAndReturn('stopNumber', current['id'])
                .setAndReturn('stopName', current['name'])
                .setAndReturn('lat', current['position'][0])
                .setAndReturn('lng', current['position'][1]).build();
            tmp_arr.push(stop);
        }
        this.stops_array = tmp_arr;
        this.emit('updated_stops');
    }

    _convert_routes_call(body_json) {
        let tmp_arr = [];
        for(let i = 0; i < body_json.length; i++) {
            let current = body_json[i];
            let rb = new route_model.RouteBuilder();
            let route = rb.setAndReturn('humanName', current['long_name'])
                .setAndReturn('routeNumber', current['id'])
                .setAndReturn('shortName', current['long_name'])
                .setAndReturn('color', "#" + current['color'])
                .setAndReturn('textColor', "#" + current['text_color'])
                .setAndReturn('active', current['is_active'])
                .setAndReturn('stopIdArray', []).setAndReturn("shapeId", current['id']).build();
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

module.exports = TranslocLink;