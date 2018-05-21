const Builder = require('./Builder');

class ETAInfoBuilder extends Builder {
    build() {
        this.setFinalized();
        try {
            this.defined("etaSeconds").defined('vehicleId').defined('linkName').defined('routeId').defined('tripNumber');
        } catch(e) {
            throw e;
        }
        let s = new ETAInfo();
        s.etaSeconds = this['etaSeconds'];
        s.vehicleId = this['vehicleId'];
        s.routeId = this['routeId'];
        s.linkName = this.linkName;
        s.tripNumber = this.tripNumber;
        return s;
    }
}

class ETAInfo {}

module.exports = {ETAInfoBuilder: ETAInfoBuilder, ETAInfo: ETAInfo};