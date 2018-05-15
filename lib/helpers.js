const redis = require("redis");

class ETAGrabber {
    constructor(redis_settings_file) {
        if(!redis_settings_file) {
            redis_settings_file = "../redis_settings.json";
        }
        let redis_settings = require(redis_settings_file);
        this._redis = redis.createClient(redis_settings);
        this._redis_used = false;
        this._redis.on('connected', function () {
            this._redis_used = true;
        });

        this._redis.on('error', function (e) {
            console.error("Redis connection failure");
            console.error(e.message);
            this._redis_used = false;
        });
    }


    /**
     * Gets the internal link object from a stop id.
     * @param stop_id
     * @return Link
     * @private
     */
    static _get_link_from_stop(stop_id) {
        for(let l of global.links) {
            if(l.contains_stop(stop_id)) {
                return l;
            }
        }
    }

    _wrap_cb_with_redis(indice, data_timeout, cb) {
        return (err, data) => {
            if(err || data === undefined) {
                cb(err, data);
            } else {
                if(data.length && data.length > 0 && this._redis_used) {
                    this._redis.setex(indice, data_timeout, JSON.stringify(data), function (error) {
                        if(error) {
                            console.error("setex error");
                            console.error(error);
                        }
                        cb(err, data);
                    });
                } else {
                    cb(err, data);
                }
            }
        }
    }

    get_eta_info(stop_id, cb) {
        let link = ETAGrabber._get_link_from_stop();
        if(this._redis_used) {
            this._redis.get(stop_id, (err, data) => {
                if(err || data === undefined) {
                    link.get_eta_info(stop_id, this._wrap_cb_with_redis(stop_id, 10, cb));
                } else {
                    cb(undefined, JSON.parse(data));
                }
            });
        } else {
            link.get_eta_info(stop_id, cb);
        }
    }
}

module.exports = {ETAGrabber: ETAGrabber};