const redis = require("redis");
const fs = require("fs");
const EventEmitter = require('events').EventEmitter;
const admin = require('firebase-admin');

class RedisManager {
    constructor(redis_settings) {
        if(!redis_settings) {
            this._config = RedisManager.read_redis_settings("redis_settings.json");
        } else {
            this._config = RedisManager.read_redis_settings(redis_settings);
        }

        this._connection = redis.createClient(this._config);
        this._connection.on('error', function (error) {
            console.warn("Redis connection error: " + error.message);
        });
    }

    get_redis_available() {
        return this._connection.connected;
    }

    get_redis_client() {
        return this._connection;
    }

    static read_redis_settings(file_loc) {
        let content = fs.readFileSync(file_loc);
        return JSON.parse(content);
    }
}

class ETAGrabber {
    constructor(redis_manager) {
        this._redis_manager = redis_manager;
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
            if(err || !data) {
                cb(err, data);
            } else {
                if(data.length && data.length > 0 && this._redis_manager.get_redis_available()) {
                    this._redis_manager.get_redis_client().setex(indice, data_timeout, JSON.stringify(data), function (error) {
                        if(error) {
                            console.error("setex error");
                            console.error(error);
                        }
                        cb(error, data);
                    });
                } else {
                    cb(err, data);
                }
            }
        }
    }

    get_eta_info(stop_id, cb) {
        let link = ETAGrabber._get_link_from_stop(stop_id);
        if(this._redis_manager.get_redis_available()) {
            this._redis_manager.get_redis_client().get(stop_id, (err, data) => {
                if(err || !data) {
                    link.get_arrival_time(stop_id, this._wrap_cb_with_redis(stop_id, 10, cb));
                } else {
                    cb(undefined, JSON.parse(data));
                }
            });
        } else {
            console.log("Warning: not using redis to make the call");
            link.get_arrival_time(stop_id, cb);
        }
    }
}

class Watcher {
    constructor(stop_id, bus_id, trip_id, notificaton_token, time_before) {
        this.stop_id = stop_id;
        this.bus_id = bus_id;
        this.trip_id = trip_id;
        this.notification_token = notificaton_token;
        this.time_before = time_before;
    }
}

class BusNotifier extends EventEmitter {
    constructor() {
        super();
        this.on('stop_update', this._handle_update);
        this._watching = {};
        this._watch_processes = {};
    }

    add_watcher(watched_stop) {
        if(!this._watching[watched_stop.stop_id]) {
            this._add_watch_process(watched_stop);
        }
    }

    /**
     *
     * @param {Watcher} watched_stop
     */
    remove_watcher(watched_stop) {
        if(watched_stop.stop_id in this._watching) {
            let indof = this._watching[watched_stop.stop_id].indexOf(watched_stop);
            if(indof !== -1) {
                this._watching[watched_stop.stop_id].splice(indof, 1);
            }
        }
    }

    _add_watch_process(watched_stop) {
        if(!this._watch_processes[watched_stop.stop_id]) {
            this._watch_processes[watched_stop.stop_id] = setInterval(this._execute_stop_update, 10000, watched_stop);
        }
    }

    /**
     *
     * @param {Watcher} watched_stop
     * @private
     */
    _execute_stop_update(watched_stop) {
        let link = ETAGrabber._get_link_from_stop(watched_stop.stop_id);
        if(link !== undefined) {
            link.get_arrival_time(watched_stop.stop_id, function (err, data) {
                if(!err && data) {
                    this.emit('stop_update', watched_stop.stop_id, data);
                }
            });
        }
    }

    /**
     *
     * @param {number} stop_id
     * @param data
     * @private
     */
    _handle_update(stop_id, data) {
        if(stop_id in this._watching && this._watching[stop_id].length > 0) {
            /** @var {Watcher} watcher */
            let watcher;
            for(watcher of this._watching[stop_id]) {
                let found = false;
                /** @var {ETAInfo} etaInfo */
                let etaInfo;
                for(etaInfo of data) {
                    if(etaInfo.vehicleId === watcher.bus_id && etaInfo.tripNumber === watcher.trip_id) {
                        if(etaInfo.etaSeconds < watcher.time_before) {
                            NotificationHelper.send_bus_notification(watcher.notification_token, watcher.bus_id, etaInfo.etaSeconds / 60 + " minutes");
                        }
                        found = true;
                    }
                }
                if(!found) {
                    //bus has passed, remove watcher
                    this.remove_watcher(watcher);
                    NotificationHelper.send_bus_missed(watcher.notification_token, watcher.bus_id);
                }
            }
        } else {
            //nobody watching, stop the updates
            clearInterval(this._watch_processes[stop_id]);
            this._watch_processes[stop_id] = undefined;
        }
    }
}

class NotificationHelper {
    static _send_firebase_call(token, data, options) {
        admin.messaging().sendToDevice(token, data, options).catch(function (error) {
            console.error("failed sending sendToDevice notification.");
            console.error(error.message);
        });
    }

    static send_bus_notification(token, bus_id, time_info) {
        NotificationHelper.send_bus_notification(token, {
            notification: {
                title: "Bus arriving soon!",
                message: "Bus " + bus_id + " is arriving in " + time_info
            }
        });
    }

    static send_bus_missed(token, bus_id) {
        NotificationHelper._send_firebase_call(token, {
            notification: {
                title: "Bus missed!",
                message: "Woops! Bus " + bus_id + " arrived much sooner than expected, and it has passed."
            }
        })
    }

    static send_notification_created(token, bus_id, time_info) {
        NotificationHelper._send_firebase_call(token, {
            notification: {
                title: "Bus notification scheduled!",
                body: "You will be notified " + time_info + " before the bus arrives"
            }
        });
    }
}
module.exports = {ETAGrabber: ETAGrabber, RedisManager: RedisManager, BusNotifier: BusNotifier, Watcher: Watcher, NotificationHelper: NotificationHelper};