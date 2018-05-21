let assert = require('assert');
const helpers = require('../../lib/helpers');
const RedisManager = helpers.RedisManager;
const ETAGrabber = helpers.ETAGrabber;
describe('RedisManager', function() {
    describe('#construct', function () {
        it('should set _redis_used = false with invalid redis credentials', function (done) {
            let connection = new RedisManager("test/data/bad_redis_settings.json");
            connection.get_redis_client().on('error', function (error) {
                assert.equal(connection.get_redis_available(), false, "_redis_used not false");
                connection.get_redis_client().quit();
                done();
            });
            connection.get_redis_client().on('connected', function () {
                connection.get_redis_client().quit();
                done(new Error("Test invalid, valid connection established"));
            });
        });
        it('should set _redis_used = true with a valid connection', function (done) {
            let connection = new RedisManager();
            connection.get_redis_client().on('error', function (error) {
                connection.get_redis_client().quit();
                done(new Error("Test invalid, a successful connection was not established."));
            });
            connection.get_redis_client().on('connected', function () {
                connection.get_redis_client().quit();
                assert.equal(connection.get_redis_available(), true, "_redis_used not true");
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
           let connection = new ETAGrabber();
           let newCB = connection._wrap_cb_with_redis(1, 1, function (err, data) {
               assert.equal(err, "apples", "err is not equal to apples");
               assert.equal(data, "oranges", "data is not equal to oranges");
               done();
           });
           newCB("apples", "oranges");
        });
    });
});