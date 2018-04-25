const Builder = require('./Builder');

class BusBuilder extends Builder {
    build() {
        this.setFinalized();
        try {
            this.defined("location")
                .defined('vehicleId')
                .defined('routeNumber')
                .defined('status');
        } catch(e) {
            throw e;
        }
        let s = new Bus();
        s.location = this.location;
        s.vehicleId = this.vehicleId;
        s.routeNumber = this.routeNumber;
        s.status = this.status;
        return s;
    }

    setLocation(lat, lng, dir) {
        if(dir === undefined) {
            dir = 0;
        }
        this.location = [parseFloat(lat), parseFloat(lng), dir];
    }
}

class BusStatus {
    static UNKNOWN() { return -1; }
    static DRIVING() { return 0; }
    static STOPPED() { return 1; }
}

class Bus {}

module.exports = {BusBuilder: BusBuilder, Bus: Bus, BusStatus: BusStatus};