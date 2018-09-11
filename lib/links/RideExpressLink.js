const Link = require("./Link");
const request = require('request');
const route_model = require('../models/Route');
const stop_model = require('../models/Stop');
const shape_model = require('../models/Shape');
const bus_model = require('../models/Bus');
const etainfo_model = require('../models/ETAInfo');

class RideExpressLink extends Link {
    constructor() {
        super();
        /**
         * TODO: Add in stop modification, so that there aren't any duplicate stop IDs between links
         * TODO: Repair bus location information.
         * TODO: Rewrite arrival time
         */
    }

    get_name() {
        return "NAU";
    }

    fetch_routes() {
        // https://mline.usetransit.com/api/1/public/routes/0/4
        this.in_progress_updates++;
        request("http://www.naubus.com/Services/JSONPRelay.svc/GetRoutesForMapWithScheduleWithEncodedLine?ApiKey=8882812681", (err, res, body_str) => {
            if (err) {
                console.error("Failed to call MountainLine route call: ");
                console.error(err);
                return;
            }
            try {
                let body = JSON.parse(body_str);
                this._convert_routes_call(body);
                this._convert_shapes_call(body);
                this._convert_stops_call(body);
            } catch (e) {
                console.error("JSON parser fail in fetch_routes");
                console.error(e);
            }
            this.in_progress_updates--;
        });
    }

    fetch_stops() {
        //nerfed. Currently does nothing.
    }

    fetch_shapes() {
        //nerfed. Currently does nothing.
    }

    fetch_buses() {
        request("http://www.naubus.com/Services/JSONPRelay.svc/GetMapVehiclePoints?ApiKey=8882812681", (err, res, body_str) => {
            if (err) {
                console.error("Failed to call TL arrival time:");
                console.error(err);
            } else {
                //TODO: add in cached responses with very short cache time
                try {
                    let body_json = JSON.parse(body_str);
                    let busLocs = [];
                    for (let part of body_json) {
                        let status = bus_model.BusStatus.UNKNOWN();
                        if (part.GroundSpeed > 0) {
                            status = bus_model.BusStatus.DRIVING();
                        } else if (part.GroundSpeed === 0) {
                            status = bus_model.BusStatus.STOPPED();
                        }
                        let tmp = new bus_model.BusBuilder();
                        tmp.setLocation(part.Latitude, part.Longitude, part.Heading);
                        tmp.setAndReturn("vehicleId", part.VehicleID)
                            .setAndReturn("status", status)
                            .setAndReturn("routeNumber", part.RouteID + 1000);
                        busLocs.push(tmp.build());
                    }
                    this.bus_array = busLocs;
                    this.emit('updated_buses');
                } catch (e) {
                    console.error("error parsing body");
                    console.error(e);
                }
            }
        });
    }

    get_arrival_time(stopNumber, cb) {
        //revert stop number to pre-edited state
        let routeNumber = parseInt(("" + stopNumber).substring(0, 4)) - 1000;
        stopNumber = parseInt(("" + stopNumber).substring(4));
        stopNumber = stopNumber - 1000;
        request("http://www.naubus.com/Services/JSONPRelay.svc/GetRouteStopArrivals?TimesPerStopString=2&ApiKey=8882812681&_=1535054543521", (err, res, body_str) => {
            if (err) {
                console.error("Failed to call TL arrival time:");
                console.error(err);
                cb(err, null);
            } else {
                //TODO: add in cached responses with very short cache time
                try {
                    let body_json = JSON.parse(body_str);
                    let etas = [];
                    for (let part of body_json) {
                        if (part.RouteID === routeNumber && part.RouteStopID === stopNumber) {
                            for (let est of part.VehicleEstimates) {
                                let tmp = new etainfo_model.ETAInfoBuilder();
                                etas.push(tmp.setAndReturn("vehicleId", est.VehicleID)
                                    .setAndReturn("etaSeconds", est.SecondsToStop)
                                    .setAndReturn("routeId", part.RouteID + 1000)
                                    .setAndReturn("linkName", "NAU").setAndReturn('tripNumber', est.VehicleID).build());
                            }
                        }
                    }
                    cb(null, etas);
                } catch (e) {
                    cb(e, null);
                }
            }
        });
    }

    _convert_shapes_call(body_json) {
        let tmp_obj = {};
        // parse out the segments and sort them.
        for (let route of body_json) {
            tmp_obj[route["RouteID"] + 1000] = new shape_model.ShapeBuilder().setAndReturn('polyline', [route["EncodedPolyline"]]).build();
        }
        this.shape_object = tmp_obj;
        this.emit('updated_shapes');
    }

    _convert_stops_call(body_json) {
        let tmp_arr = [];
        let tmp_arr3 = [];
        for (let i = 0; i < this.route_array.length; i++) {
            let tmp_arr2 = [];
            let currentRoute = this.route_array[i];
            for (let j = 0; j < body_json[i]["Stops"].length; j++) {
                let current = body_json[i]["Stops"][j];
                let adjustedStopNum = parseInt(currentRoute.routeNumber + "" + (current.RouteStopID + 1000));
                if (!tmp_arr3.includes(adjustedStopNum)) {
                    let sb = new stop_model.StopBuilder();
                    let stop = sb.setAndReturn('stopNumber', adjustedStopNum)
                        .setAndReturn('stopName', current['SignVerbiage'])
                        .setAndReturn('lat', current['Latitude'])
                        .setAndReturn('lng', current['Longitude']).build();
                    tmp_arr3.push(stop.stopNumber);
                    tmp_arr.push(stop);
                }
                tmp_arr2.push(adjustedStopNum);
            }
            currentRoute.stopIdArray = tmp_arr2;
        }
        this.stops_array = tmp_arr;
        this.emit('updated_stops');
    }

    _convert_routes_call(body_json) {
        if (body_json === undefined) {
            console.warn("[TL] Didn't receive any routes. TL may be out of service.");
            return;
        }
        let tmp_arr = [];
        for (let i = 0; i < body_json.length; i++) {
            let current = body_json[i];
            let rb = new route_model.RouteBuilder();
            let route = rb.setAndReturn('humanName', current['Description'])
                .setAndReturn('routeNumber', current['RouteID'] + 1000)
                .setAndReturn('shortName', current['Description'])
                .setAndReturn('color', current['MapLineColor'])
                .setAndReturn('textColor', "#ffffff")
                .setAndReturn('active', current['IsVisibleOnMap'])
                .setAndReturn('stopIdArray', []).setAndReturn("shapeId", current['RouteID'] + 1000).build();
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

module.exports = RideExpressLink;