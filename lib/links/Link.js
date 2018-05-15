const EventEmitter = require("events").EventEmitter;

class Link extends EventEmitter {
    constructor() {
        super();
        this.ready = false;
        this.route_array = [];
        this.stops_array = [];
        this.shape_object = {};
        this.bus_array = [];
        this.in_progress_updates = 0;
        this.on('updated_routes', this.fetch_stops); //ensure stops are updated when the routes are updated
        this.on('updated_routes', this.fetch_shapes); //ensure route shape is updated
        this.on('updated_shapes', () => {this.ready = true;})
    }

    fetch_buses() {
        throw new Error("Not implemented");
    }

    /**
     * Get route according to the spec
     *
     * @return Route[]
     */
    get_routes() {
        let tmp_arr = [];
        for(let item of this.route_array) {
            tmp_arr.push(this.build_route(item));
        }
        return tmp_arr;
    }

    get_stops() {
        return this.stops_array;
    }

    contains_stop(stop_id) {
        for(let s of this.stops_array) {
            if(s.stopNumber === stop_id)
                return true;
        }
        return false;
    }

    build_route(route_obj) {
        throw new Error("Route Build not implemented");
    }

    /**
     * Fetch the latest route info from server.
     *
     */
    fetch_routes() {
        throw new Error("Fetch not implemented.");
    }

    fetch_stops() {
        throw new Error("Fetch not implemented.");
    }

    fetch_shapes() {
        throw new Error("Fetch not implemented.");
    }

    get_arrival_time(stopNumber, cb) {
        //TODO: Caching this call will increase speed dramatically
        throw new Error("arrival time not implemented");
    }
}

module.exports = Link;