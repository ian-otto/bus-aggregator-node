let assert = require('assert');
let MountainLineLink = require("../../lib/links/MountainLineLink");

describe('MountainLineLink', function() {
    let link = undefined;
    describe("#construct", function () {
        it('should not error', function () {
            link = new MountainLineLink();
            link.fetch_routes();
        })
    });
    describe('#fetch_routes', function() {
        this.timeout(6000);
        it('route_array should be larger than one', function(done) {
            link.on('updated_routes',function () {
                if(link.route_array.length > 0) done();
                else done(new Error("Route_array not greater than 1"));
            });
        });
        it('should call #fetch_stops', function (done) {
            link.on('updated_stops',function () {
                done();
            });
        });
        it('should call #fetch_shapes', function (done) {
            link.on('updated_shapes',function () {
                done();
            });
        });
    });
    describe('#fetch_stops', function() {
        this.timeout(4000);
        it('stops_array should be larger than one', function(done) {
            if(link.stops_array.length > 0) done();
            else done(new Error("Route_array not greater than 1"));
        });
    });
    describe('#fetch_shapes', function() {
        this.timeout(15000);
        it('shapes_object should be larger than one', function(done) {
            for(let prop in link.shape_object) {
                if(link.shape_object.hasOwnProperty(prop)) {
                    if(link.shape_object[prop].hasOwnProperty('polyline'))
                        done();
                    else done(new Error("Length 0 in link props"));
                    return;
                }
            }
            done(new Error("Route_array not greater than 1"));
        });
    });
    describe("#fetch_buses", function () {
        this.timeout(4000);
        it('should call without error', function(done) {
            try {
                link.fetch_buses();
                done();
            } catch(e) {
                done(e);
            }
        });
    });
    describe("#get_arrival_times", function () {
        it('should not error', function (done) {
            this.timeout(5000);
            link.get_arrival_time(24, function(err, data) {
                if(err) {
                    done(new Error(err));
                    return;
                }
                done();
            });
        });
    })
});