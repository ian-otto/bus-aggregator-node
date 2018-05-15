let assert = require('assert');
const ETAGrabber = require('../../lib/helpers').ETAGrabber;
describe('ETAGrabber', function() {
    describe('#construct', function () {
        it('should set _redis_used = false with invalid redis credentials', function (done) {
            let connection = new ETAGrabber("../test/data/bad_redis_settings.json");
            connection._redis.on('error', function (error) {
                assert.equal(connection._redis_used, false, "_redis_used not false");
                done();
            });
            connection._redis.on('connected', function () {
                done(new Error("Test invalid, valid connection established"));
            });
        });
        it('should set _redis_used = true with a valid connection', function (done) {
            let connection = new ETAGrabber();
            connection._redis.on('error', function (error) {
                console.error(error);
                done(new Error("Test invalid, a successful connection was not established."));
            });
            connection._redis.on('connected', function () {
                assert.equal(connection._redis_used, true, "_redis_used not true");
                done();
            })
        })
    });
    describe('#_wrap_cb_with_redis', function() {
        it('should return a function', function () {
            let connection = new ETAGrabber();
            let newCB = connection._wrap_cb_with_redis(1, 1, function () {});
            assert.equal(typeof newCB, "function", "callback was not a function...");
        });
        it('should call the original callback', function (done) {
           let connection = new ETAGrabber("../test/data/bad_redis_settings.json");
           let newCB = connection._wrap_cb_with_redis(1, 1, function (err, data) {
               assert.equal(err, "apples", "err is not equal to apples");
               assert.equal(data, "oranges", "data is not equal to oranges");
               done();
           });
           newCB("apples", "oranges");
        });
    });
});